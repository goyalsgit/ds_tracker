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
    .select("id, question_id, solved_at")
    .eq("user_id", userId);

  if (solvesError) {
    return Response.json({ error: "Failed to load solves." }, { status: 500 });
  }

  const solveIds = solves?.map((solve) => solve.id) ?? [];
  if (solveIds.length === 0) {
    return Response.json({ today: [], upcoming: [] });
  }

  const today = toDateString(new Date());
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const futureDate = toDateString(sevenDaysLater);

  // Fetch today's revisions (all statuses so user can see what's done too)
  const { data: todayRevisions, error: todayError } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .eq("due_on", today)
    .in("solve_id", solveIds)
    .order("stage", { ascending: true });

  if (todayError) {
    return Response.json({ error: "Failed to load today's revisions." }, { status: 500 });
  }

  // Fetch upcoming revisions (next 7 days, only scheduled)
  const { data: upcomingRevisions, error: upcomingError } = await supabaseServer
    .from("revisions")
    .select("id, solve_id, stage, due_on, status, completed_at")
    .gt("due_on", today)
    .lte("due_on", futureDate)
    .eq("status", "scheduled")
    .in("solve_id", solveIds)
    .order("due_on", { ascending: true })
    .order("stage", { ascending: true });

  if (upcomingError) {
    return Response.json({ error: "Failed to load upcoming revisions." }, { status: 500 });
  }

  const questionIds = solves?.map((solve) => solve.question_id) ?? [];
  const { data: questions } = await supabaseServer
    .from("questions")
    .select("id, title, source_url, difficulty, tags")
    .in("id", questionIds);

  const solveMap = new Map(solves?.map((solve) => [solve.id, solve]) ?? []);
  const questionMap = new Map(questions?.map((q) => [q.id, q]) ?? []);

  function mapRevision(revision: {
    id: string;
    solve_id: string;
    stage: number;
    due_on: string;
    status: string;
    completed_at: string | null;
  }) {
    const solve = solveMap.get(revision.solve_id);
    const question = solve ? questionMap.get(solve.question_id) : null;
    return {
      id: revision.id,
      solveId: revision.solve_id,
      stage: revision.stage,
      label: `Stage ${revision.stage}`,
      dueOn: revision.due_on,
      status: revision.status,
      completedAt: revision.completed_at,
      title: question?.title ?? "Revision",
      sourceUrl: question?.source_url ?? "",
      difficulty: (question?.difficulty ?? "Easy") as "Easy" | "Medium" | "Hard",
      tags: (question?.tags as string[]) ?? [],
    };
  }

  return Response.json({
    today: (todayRevisions ?? []).map(mapRevision),
    upcoming: (upcomingRevisions ?? []).map(mapRevision),
    // keep legacy key so existing callers don't break
    revisions: (todayRevisions ?? []).map(mapRevision),
  });
}
