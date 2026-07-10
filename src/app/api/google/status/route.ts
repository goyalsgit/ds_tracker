import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ connected: false }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("google_tokens")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ connected: false }, { status: 500 });
  }

  return Response.json({ connected: Boolean(data?.id) });
}
