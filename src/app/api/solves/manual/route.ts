import { buildRevisionSchedule, toDateInputValue } from "@/lib/revisionScheduler";
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    sourceUrl?: string;
    difficulty?: "Easy" | "Medium" | "Hard";
    tags?: string[];
    code?: string;
    language?: string;
  };

  const title = body.title?.trim();
  if (!title) {
    return Response.json({ error: "Title is required." }, { status: 400 });
  }

  const code = body.code?.trim() ?? "";
  const language = body.language?.trim() ?? "cpp";

  const supabaseServer = getSupabaseServer();
  const userId = await getOrCreateUserId(authUser);

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data: question, error: questionError } = await supabaseServer
    .from("questions")
    .upsert(
      {
        title,
        slug,
        source_url: body.sourceUrl ?? null,
        difficulty: body.difficulty ?? "Easy",
        tags: body.tags ?? [],
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (questionError || !question) {
    return Response.json({ error: "Failed to save question." }, { status: 500 });
  }

  const solvedAt = new Date();
  const { data: solve, error: solveError } = await supabaseServer
    .from("solves")
    .insert({
      user_id: userId,
      question_id: question.id,
      solved_at: solvedAt.toISOString(),
      source: "manual",
      code,
      language,
    })
    .select("id")
    .single();

  if (solveError || !solve) {
    return Response.json({ error: "Failed to save solve." }, { status: 500 });
  }

  // Update question's last_solved_at
  await supabaseServer
    .from("questions")
    .update({ last_solved_at: solvedAt.toISOString() })
    .eq("id", question.id);

  const schedule = buildRevisionSchedule(solvedAt);
  const revisionRows = schedule.map((entry) => ({
    solve_id: solve.id,
    stage: entry.stage,
    due_on: toDateInputValue(entry.dueDate),
    status: "scheduled",
  }));

  const { error: revisionError } = await supabaseServer
    .from("revisions")
    .insert(revisionRows);

  if (revisionError) {
    return Response.json({ error: "Failed to create revisions." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
