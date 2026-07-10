import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { toDateInputValue } from "@/lib/revisionScheduler";

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: allSolves, error: solvesError } = await supabaseServer
    .from("solves")
    .select("id, question_id, solved_at, source, code, language")
    .eq("user_id", userId)
    .order("solved_at", { ascending: false });

  if (solvesError) {
    return Response.json({ error: "Failed to load solves." }, { status: 500 });
  }

  if (!allSolves || allSolves.length === 0) {
    return Response.json({ solves: [] });
  }

  const questionIds = allSolves.map((s) => s.question_id);
  const { data: allQuestions } = await supabaseServer
    .from("questions")
    .select("id, title, slug, source_url, difficulty, tags, last_solved_at")
    .in("id", questionIds);

  const questionMap = new Map((allQuestions ?? []).map((q) => [q.id, q]));

  const solveIds = allSolves.map((s) => s.id);
  const { data: allRevisions } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .in("solve_id", solveIds)
    .order("stage", { ascending: true });

  // Group revisions by solve_id
  const revisionsBySolve = new Map<string, typeof allRevisions>();
  for (const rev of allRevisions ?? []) {
    if (!revisionsBySolve.has(rev.solve_id)) revisionsBySolve.set(rev.solve_id, []);
    revisionsBySolve.get(rev.solve_id)!.push(rev);
  }

  const solves = allSolves.map((s) => {
    const q = questionMap.get(s.question_id);
    const stages = (revisionsBySolve.get(s.id) ?? []).map((r) => ({
      stage: r.stage,
      dueOn: r.due_on,
      status: r.status,
      completedAt: r.completed_at,
    }));
    return {
      id: s.id,
      title: q?.title ?? "Unknown",
      sourceUrl: q?.source_url ?? "",
      difficulty: (q?.difficulty as "Easy" | "Medium" | "Hard") ?? "Easy",
      tags: (q?.tags as string[]) ?? [],
      solvedOn: toDateInputValue(new Date(s.solved_at)),
      lastSolvedAt: q?.last_solved_at ? toDateInputValue(new Date(q.last_solved_at)) : null,
      source: s.source,
      code: s.code ?? "",
      language: s.language ?? "cpp",
      revisionStages: stages,
    };
  });

  return Response.json({ solves });
}
