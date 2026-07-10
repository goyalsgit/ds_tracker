import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    revisionId?: string;
    status?: "done" | "failed" | "scheduled";
  };

  const revisionId = body.revisionId?.trim();
  const status = body.status ?? "done";

  if (!revisionId) {
    return Response.json({ error: "revisionId required." }, { status: 400 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: solveIds } = await supabaseServer
    .from("solves")
    .select("id")
    .eq("user_id", userId);

  const validSolveIds = solveIds?.map((solve) => solve.id) ?? [];

  const { data: revisionRow } = await supabaseServer
    .from("revisions")
    .select("id, solve_id")
    .eq("id", revisionId)
    .maybeSingle();

  if (!revisionRow || !validSolveIds.includes(revisionRow.solve_id)) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const completedAt = status === "scheduled" ? null : new Date().toISOString();

  const { error } = await supabaseServer
    .from("revisions")
    .update({ status, completed_at: completedAt })
    .eq("id", revisionId);

  if (error) {
    return Response.json({ error: "Failed to update revision." }, { status: 500 });
  }

  return Response.json({ revisionId, status });
}
