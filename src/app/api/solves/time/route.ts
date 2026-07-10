import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/solves/time
 * Update solve time for a problem
 */
export async function PATCH(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    solveId?: string;
    timeMinutes?: number;
  };

  const solveId = body.solveId?.trim();
  const timeMinutes = body.timeMinutes;

  if (!solveId || timeMinutes === undefined) {
    return Response.json({ error: "solveId and timeMinutes required." }, { status: 400 });
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

  // Update solve time
  const { error } = await supabaseServer
    .from("solves")
    .update({ solve_time_minutes: timeMinutes })
    .eq("id", solveId);

  if (error) {
    return Response.json({ error: "Failed to update solve time." }, { status: 500 });
  }

  return Response.json({ ok: true, solveId, timeMinutes });
}
