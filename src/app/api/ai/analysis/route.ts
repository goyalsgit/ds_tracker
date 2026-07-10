/**
 * GET /api/ai/analysis
 * Returns weak area analysis + daily plan based on revision history.
 *
 * Returns: { weakAreas: string, dailyPlan: string, streak: number }
 *
 * Uses Gemini 1.5 Flash (free: 1M tokens/day).
 * ~700 tokens per call → ~1,400 analyses/day free.
 *
 * ── Streak calculation ────────────────────────────────────────────────────
 * A "streak day" = any day where at least 1 revision was completed (done/failed).
 * Streak resets if you miss a day that had revisions due.
 */

import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getWeakAreaAnalysis, getDailyPlan } from "@/lib/gemini";
import { toDateInputValue } from "@/lib/revisionScheduler";

function toDateStr(d: Date) { return toDateInputValue(d); }

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();

  // ── Load all solves for this user ──────────────────────────────────────
  const { data: solves } = await supabase
    .from("solves")
    .select("id, question_id")
    .eq("user_id", userId);

  const solveIds = (solves ?? []).map((s) => s.question_id);
  const solveRowIds = (solves ?? []).map((s) => s.id);

  // ── Load questions for tag info ────────────────────────────────────────
  const { data: questions } = await supabase
    .from("questions")
    .select("id, title, difficulty, tags")
    .in("id", solveIds);

  const questionMap = new Map((questions ?? []).map((q) => [q.id, q]));
  const solveToQuestion = new Map(
    (solves ?? []).map((s) => [s.id, questionMap.get(s.question_id)])
  );

  // ── Load revisions for streak + weak area analysis ─────────────────────
  // Streak needs completed_at going back up to 365 days, not just 30
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Load ALL completed revisions for streak (no date filter on completed_at)
  const { data: allCompletedRevisions } = await supabase
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .in("solve_id", solveRowIds)
    .in("status", ["done", "failed"])
    .order("completed_at", { ascending: false });

  // Load recent revisions (30 days) for weak area analysis
  const { data: revisions } = await supabase
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .in("solve_id", solveRowIds)
    .gte("due_on", toDateStr(thirtyDaysAgo))
    .order("due_on", { ascending: false });

  // ── Calculate streak ───────────────────────────────────────────────────
  // Uses allCompletedRevisions (no date cap) so streak is accurate even
  // if you've been consistent for more than 30 days.
  const completedDays = new Set<string>();
  for (const rev of allCompletedRevisions ?? []) {
    // Prefer completed_at timestamp; fall back to due_on
    const dateStr = rev.completed_at
      ? toDateStr(new Date(rev.completed_at))
      : rev.due_on;
    completedDays.add(dateStr);
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = toDateStr(d);
    if (completedDays.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      // Allow today to be incomplete (don't break streak for today)
      break;
    }
  }

  // ── Find failed/overdue problems for weak area analysis ────────────────
  const failMap = new Map<string, { title: string; tags: string[]; difficulty: string; failCount: number }>();

  for (const rev of revisions ?? []) {
    if (rev.status === "failed" || rev.status === "overdue") {
      const q = solveToQuestion.get(rev.solve_id);
      if (!q) continue;
      const key = rev.solve_id;
      if (!failMap.has(key)) {
        failMap.set(key, {
          title: q.title ?? "Unknown",
          tags: (q.tags as string[]) ?? [],
          difficulty: q.difficulty ?? "Medium",
          failCount: 0,
        });
      }
      failMap.get(key)!.failCount++;
    }
  }

  const failedProblems = Array.from(failMap.values())
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 10);

  // ── Today's pending revisions for daily plan ───────────────────────────
  const todayStr = toDateStr(new Date());
  const todayRevisions = (revisions ?? []).filter(
    (r) => r.due_on === todayStr && (r.status === "scheduled" || r.status === "overdue")
  );

  const pendingTopics = todayRevisions
    .map((r) => {
      const q = solveToQuestion.get(r.solve_id);
      return (q?.tags as string[] | undefined)?.[0] ?? "";
    })
    .filter(Boolean);

  const recentFailedTopics = failedProblems
    .flatMap((p) => p.tags)
    .filter(Boolean)
    .slice(0, 5);

  // ── Call Gemini for analysis ───────────────────────────────────────────
  let weakAreas = "No weak areas detected yet — keep revising!";
  let dailyPlan = "Keep up the great work!";

  try {
    [weakAreas, dailyPlan] = await Promise.all([
      getWeakAreaAnalysis(failedProblems),
      getDailyPlan({
        todayRevisionCount: todayRevisions.length,
        pendingTopics: [...new Set(pendingTopics)],
        recentFailedTopics: [...new Set(recentFailedTopics)],
        streak,
      }),
    ]);
  } catch (err) {
    // Gemini not configured or API error — still return streak data
    const msg = err instanceof Error ? err.message : "Unknown error";
    weakAreas = msg.includes("GEMINI_API_KEY")
      ? "Add GEMINI_API_KEY to .env.local to enable AI analysis."
      : `AI error: ${msg}`;
    dailyPlan = msg.includes("GEMINI_API_KEY")
      ? "Add GEMINI_API_KEY to .env.local to enable daily plans."
      : `AI error: ${msg}`;
  }

  return Response.json({
    streak,
    weakAreas,
    dailyPlan,
    failedCount: failedProblems.length,
    completedLast30Days: (revisions ?? []).filter((r) => r.status === "done").length,
  });
}
