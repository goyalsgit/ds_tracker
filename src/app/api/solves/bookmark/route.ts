import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/solves/bookmark
 * Toggle bookmark status for a problem
 */
export async function PATCH(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    solveId?: string;
    isBookmarked?: boolean;
  };

  const solveId = body.solveId?.trim();
  if (!solveId) {
    return Response.json({ error: "solveId required." }, { status: 400 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  // Verify this solve belongs to the user
  const { data: solve } = await supabaseServer
    .from("solves")
    .select("id")
    .eq("id", solveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!solve) {
    return Response.json({ error: "Solve not found." }, { status: 404 });
  }

  // Toggle or set bookmark
  const { error } = await supabaseServer
    .from("solves")
    .update({ is_bookmarked: body.isBookmarked ?? true })
    .eq("id", solveId);

  if (error) {
    return Response.json({ error: "Failed to update bookmark." }, { status: 500 });
  }

  return Response.json({ ok: true, solveId, isBookmarked: body.isBookmarked });
}
