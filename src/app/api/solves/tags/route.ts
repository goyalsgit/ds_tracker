/**
 * PATCH /api/solves/tags
 * Update tags for a question (by solve ID).
 * Body: { solveId: string, tags: string[] }
 */
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function PATCH(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json()) as { solveId?: string; tags?: string[] };
  if (!body.solveId) return Response.json({ error: "solveId required." }, { status: 400 });

  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();

  // Verify this solve belongs to the user
  const { data: solve } = await supabase
    .from("solves").select("id, question_id").eq("id", body.solveId).eq("user_id", userId).maybeSingle();
  if (!solve) return Response.json({ error: "Not found." }, { status: 404 });

  const tags = (body.tags ?? []).map((t: string) => t.trim().toLowerCase()).filter(Boolean);

  const { error } = await supabase
    .from("questions").update({ tags }).eq("id", solve.question_id);
  if (error) return Response.json({ error: "Failed to update tags." }, { status: 500 });

  return Response.json({ ok: true, tags });
}
