/**
 * ── LeetCode Sync Route ────────────────────────────────────────────────────
 *
 * POST /api/leetcode/sync
 *
 * Called automatically on every login (silent mode) and manually by user.
 *
 * What it does:
 *   1. Fetches last 50 accepted submissions from LeetCode GraphQL API
 *   2. For NEW problems: creates question + solve + 5-stage revision schedule
 *   3. For EXISTING problems: auto-marks pending revisions as "done" if the
 *      user re-solved the problem on LeetCode after the revision due date
 *      (this is the "auto-tick" feature — no manual marking needed)
 *
 * Auto-sync on login:
 *   - DashboardClient calls this with silent=true on every login
 *   - Username is loaded from settings table (saved once, persists forever)
 *   - New problems appear automatically without any user action
 *
 * LeetCode API note:
 *   - Uses unofficial GraphQL endpoint (leetcode.com/graphql)
 *   - Not officially supported — may change without notice
 *   - Rate limit: ~60 req/min observed
 *   - If it breaks: user can still add problems manually via /api/solves/manual
 *
 * TO SWITCH TO LOCAL SQLite:
 *   Replace all supabaseServer.from("...") calls with SQLite queries.
 *   The logic stays identical — only the DB client changes.
 */
import { buildRevisionSchedule, toDateInputValue } from "@/lib/revisionScheduler";
import { fetchLeetCodeProfile, fetchQuestionDetail } from "@/lib/leetcode";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";

type SolveEntry = {
  id: string;
  title: string;
  sourceUrl: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  solvedOn: string;
};

type RevisionStageStatus = {
  stage: number;
  dueOn: string;
  status: string; // scheduled | done | failed | overdue
};

type SolveWithRevisions = SolveEntry & {
  revisionStages: RevisionStageStatus[];
};

type SyncResponse = {
  username: string;
  stats: {
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
  };
  solves: SolveWithRevisions[];
  newProblems: number;
  autoMarked: number; // revisions auto-marked done because problem was re-solved on LC
};

export async function POST(request: Request) {
  try {
    const supabaseServer = getSupabaseServer();
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json()) as { username?: string };
    const username = body.username?.trim();
    if (!username) {
      return Response.json({ error: "Username is required." }, { status: 400 });
    }

    console.log(`[LeetCode Sync] Starting sync for username: ${username}`);

    // Fetch recent accepted submissions from LeetCode
    // Note: LeetCode API has limitations - it may return fewer than requested
    // For users with many problems, we fetch in batches
    const limit = 100; // Request more submissions
    const profile = await fetchLeetCodeProfile(username, limit);
    console.log(`[LeetCode Sync] Fetched ${profile.recentSubmissions.length} submissions (requested ${limit})`);
    
    const userId = await getOrCreateUserId(authUser);

    // Build a map: titleSlug → most recent accepted timestamp
    const lcSolvedMap = new Map<string, number>();
    for (const sub of profile.recentSubmissions) {
      const ts = Number(sub.timestamp);
      const existing = lcSolvedMap.get(sub.titleSlug);
      if (!existing || ts > existing) lcSolvedMap.set(sub.titleSlug, ts);
    }

    let newProblems = 0;
    let autoMarked = 0;
    const todayStr = toDateInputValue(new Date());

    for (const [titleSlug, timestamp] of lcSolvedMap.entries()) {
      const title = profile.recentSubmissions.find((s) => s.titleSlug === titleSlug)?.title ?? titleSlug;
      const sourceUrl = `https://leetcode.com/problems/${titleSlug}/`;
      const solvedAt = new Date(timestamp * 1000);

      // Upsert question (fetch detail only if new)
      const { data: existingQuestion } = await supabaseServer
        .from("questions")
        .select("id, difficulty, tags")
        .eq("slug", titleSlug)
        .maybeSingle();

      let questionId: string;
      let difficulty: "Easy" | "Medium" | "Hard" = "Medium";
      let tags: string[] = [];

      if (existingQuestion) {
        questionId = existingQuestion.id;
        difficulty = (existingQuestion.difficulty as "Easy" | "Medium" | "Hard") ?? "Medium";
        tags = (existingQuestion.tags as string[]) ?? [];
      } else {
        const detail = await fetchQuestionDetail(titleSlug);
        if (detail) {
          difficulty = detail.difficulty;
          tags = detail.topicTags.map((t) => t.name.toLowerCase());
        }
        const { data: newQ, error: qErr } = await supabaseServer
          .from("questions")
          .upsert({ title, slug: titleSlug, source_url: sourceUrl, difficulty, tags }, { onConflict: "slug" })
          .select("id")
          .single();
        if (qErr || !newQ) continue;
        questionId = newQ.id;
      }

      // Check existing solve
      const { data: existingSolve } = await supabaseServer
        .from("solves")
        .select("id, solved_at")
        .eq("user_id", userId)
        .eq("question_id", questionId)
        .maybeSingle();

      if (existingSolve) {
        // Problem already tracked.
        // Update last_solved_at to the most recent solve time
        const oldTimestamp = new Date(existingSolve.solved_at);
        const isNewer = solvedAt > oldTimestamp;
        
        if (isNewer) {
          console.log(`[LeetCode Sync] Re-solved ${title}: ${oldTimestamp.toLocaleString()} → ${solvedAt.toLocaleString()}`);
          
          // Update solve timestamp
          await supabaseServer
            .from("solves")
            .update({ solved_at: solvedAt.toISOString() })
            .eq("id", existingSolve.id);
          
          // Update question's last_solved_at
          await supabaseServer
            .from("questions")
            .update({ last_solved_at: solvedAt.toISOString() })
            .eq("id", questionId);
          
          // Mark all old revisions as "done" since user re-solved the problem
          await supabaseServer
            .from("revisions")
            .update({ status: "done", completed_at: solvedAt.toISOString() })
            .eq("solve_id", existingSolve.id)
            .in("status", ["scheduled", "overdue"]);
          
          // Create NEW revision schedule starting from today
          const schedule = buildRevisionSchedule(solvedAt);
          const revisionRows = schedule.map((entry) => {
            const dueStr = toDateInputValue(entry.dueDate);
            const status = dueStr < todayStr ? "overdue" : "scheduled";
            return { solve_id: existingSolve.id, stage: entry.stage, due_on: dueStr, status };
          });
          
          // Delete old revisions and insert new ones
          await supabaseServer
            .from("revisions")
            .delete()
            .eq("solve_id", existingSolve.id);
          
          await supabaseServer
            .from("revisions")
            .insert(revisionRows);
          
          autoMarked++;
          console.log(`[LeetCode Sync] Created new revision schedule for ${title}`);
        }
        
        continue;
      }

      // New solve — insert
      const { data: solve, error: solveError } = await supabaseServer
        .from("solves")
        .insert({ user_id: userId, question_id: questionId, solved_at: solvedAt.toISOString(), source: "leetcode" })
        .select("id")
        .single();
      if (solveError || !solve) continue;

      // Update question's last_solved_at for new solve
      await supabaseServer
        .from("questions")
        .update({ last_solved_at: solvedAt.toISOString() })
        .eq("id", questionId);

      const schedule = buildRevisionSchedule(solvedAt);
      const revisionRows = schedule.map((entry) => {
        const dueStr = toDateInputValue(entry.dueDate);
        const status = dueStr < todayStr ? "overdue" : "scheduled";
        return { solve_id: solve.id, stage: entry.stage, due_on: dueStr, status };
      });
      await supabaseServer.from("revisions").insert(revisionRows);
      newProblems++;
      console.log(`[LeetCode Sync] Added new problem: ${title}`);
    }

    console.log(`[LeetCode Sync] Summary - New: ${newProblems}, Auto-marked: ${autoMarked}`);

    // ── Load all solves + their revision stages for the response ──────────
    const { data: allSolves } = await supabaseServer
      .from("solves")
      .select("id, question_id, solved_at, source")
      .eq("user_id", userId)
      .order("solved_at", { ascending: false });

    const questionIds = (allSolves ?? []).map((s) => s.question_id);
    const { data: allQuestions } = await supabaseServer
      .from("questions")
      .select("id, title, slug, source_url, difficulty, tags")
      .in("id", questionIds);

    const questionMap = new Map((allQuestions ?? []).map((q) => [q.id, q]));

    const solveIds = (allSolves ?? []).map((s) => s.id);
    const { data: allRevisions } = await supabaseServer
      .from("revisions")
      .select("id, solve_id, stage, due_on, status")
      .in("solve_id", solveIds)
      .order("stage", { ascending: true });

    // Group revisions by solve_id
    const revisionsBySolve = new Map<string, typeof allRevisions>();
    for (const rev of allRevisions ?? []) {
      if (!revisionsBySolve.has(rev.solve_id)) revisionsBySolve.set(rev.solve_id, []);
      revisionsBySolve.get(rev.solve_id)!.push(rev);
    }

    const solves: SolveWithRevisions[] = (allSolves ?? []).map((s) => {
      const q = questionMap.get(s.question_id);
      const stages = (revisionsBySolve.get(s.id) ?? []).map((r) => ({
        stage: r.stage,
        dueOn: r.due_on,
        status: r.status,
      }));
      return {
        id: s.id,
        title: q?.title ?? "Unknown",
        sourceUrl: q?.source_url ?? "",
        difficulty: (q?.difficulty as "Easy" | "Medium" | "Hard") ?? "Easy",
        tags: (q?.tags as string[]) ?? [],
        solvedOn: toDateInputValue(new Date(s.solved_at)),
        revisionStages: stages,
      };
    });

    const response: SyncResponse = {
      username: profile.username,
      stats: profile.stats,
      solves,
      newProblems,
      autoMarked,
    };

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    console.error("[LeetCode Sync] Error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
