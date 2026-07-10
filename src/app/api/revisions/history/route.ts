import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: solves, error: solvesError } = await supabaseServer
    .from("solves")
    .select("id, question_id")
    .eq("user_id", userId);

  if (solvesError) {
    return Response.json({ error: "Failed to load solves." }, { status: 500 });
  }

  const solveIds = solves?.map((solve) => solve.id) ?? [];
  if (solveIds.length === 0) {
    return Response.json({ revisions: [] });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? "20"); // Default to 20 days
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const { data: revisions, error: revisionsError } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .in("solve_id", solveIds)
    .gte("due_on", toDateString(start))
    .lte("due_on", toDateString(end))
    .order("due_on", { ascending: false });

  if (revisionsError) {
    return Response.json({ error: "Failed to load revisions." }, { status: 500 });
  }

  const questionIds = solves?.map((solve) => solve.question_id) ?? [];
  const { data: questions } = await supabaseServer
    .from("questions")
    .select("id, title, source_url, difficulty, tags")
    .in("id", questionIds);

  const solveMap = new Map(solves?.map((solve) => [solve.id, solve]) ?? []);
  const questionMap = new Map(questions?.map((q) => [q.id, q]) ?? []);

  const result = (revisions ?? []).map((revision) => {
    const solve = solveMap.get(revision.solve_id);
    const question = solve ? questionMap.get(solve.question_id) : null;
    return {
      id: revision.id,
      solveId: revision.solve_id,
      stage: revision.stage,
      dueOn: revision.due_on,
      status: revision.status,
      completedAt: revision.completed_at,
      title: question?.title ?? "Revision",
      sourceUrl: question?.source_url ?? "",
      difficulty: (question?.difficulty ?? "Easy") as "Easy" | "Medium" | "Hard",
      tags: (question?.tags as string[]) ?? [],
    };
  });

  return Response.json({ revisions: result });
}
