/**
 * ── LeetCode Username Settings ─────────────────────────────────────────────
 *
 * Stores the user's LeetCode username in Supabase settings table.
 * This means the user enters it ONCE and it persists across all logins.
 *
 * Flow:
 *   1. User enters username → POST /api/settings/leetcode → saved to DB
 *   2. On every login → GET /api/settings/leetcode → username auto-loaded
 *   3. Auto-sync triggers immediately with saved username
 *   4. User never needs to re-enter it
 *
 * TO SWITCH TO LOCAL STORAGE (if Supabase is unavailable):
 *   Replace the DB read/write with:
 *     GET: return localStorage.getItem("lc_username") ?? ""
 *     POST: localStorage.setItem("lc_username", leetcodeUsername)
 *   Note: localStorage only works client-side, so move this logic to
 *   the DashboardClient component directly.
 */
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("settings")
    .select("leetcode_username, leetcode_session")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Failed to load settings." }, { status: 500 });
  }

  return Response.json({
    leetcodeUsername: data?.leetcode_username ?? "",
    hasSession: Boolean(data?.leetcode_session),
  });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    leetcodeUsername?: string;
    leetcodeSession?: string;
  };
  const leetcodeUsername = body.leetcodeUsername?.trim() ?? "";
  const leetcodeSession = body.leetcodeSession?.trim() ?? null;

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: existing } = await supabaseServer
    .from("settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  // Build update object — only update session if explicitly provided
  const updateObj: Record<string, unknown> = {
    leetcode_username: leetcodeUsername || null,
  };
  if (leetcodeSession !== null) {
    updateObj.leetcode_session = leetcodeSession || null;
  }

  let error;
  if (existing) {
    const result = await supabaseServer
      .from("settings")
      .update(updateObj)
      .eq("user_id", userId);
    error = result.error;
  } else {
    const result = await supabaseServer
      .from("settings")
      .insert({ user_id: userId, ...updateObj });
    error = result.error;
  }

  if (error) {
    console.error("Settings save error:", error);
    return Response.json({ error: `Failed to save settings: ${error.message}` }, { status: 500 });
  }

  return Response.json({ leetcodeUsername, sessionSaved: Boolean(leetcodeSession) });
}
