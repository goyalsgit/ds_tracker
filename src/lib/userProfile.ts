import { getSupabaseServer } from "@/lib/supabaseServer";
import type { AuthUser } from "@/lib/authServer";

export async function getOrCreateUserId(authUser: AuthUser): Promise<string> {
  const supabaseServer = getSupabaseServer();
  const { data: existing, error } = await supabaseServer
    .from("users")
    .select("id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch user.");
  }

  if (existing?.id) return existing.id;

  const { data, error: insertError } = await supabaseServer
    .from("users")
    .insert({
      auth_user_id: authUser.id,
      email: authUser.email ?? `user-${authUser.id}@local`,
      name: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null,
    })
    .select("id")
    .single();

  if (insertError || !data) {
    throw new Error("Failed to create user.");
  }

  // ── Auto-create settings row for new user ────────────────────────────────
  // This ensures every user has a settings row from the start
  // Prevents "Failed to save settings" error on first login
  await supabaseServer
    .from("settings")
    .insert({
      user_id: data.id,
      timezone: "UTC",
      daily_revision_limit: 6,
      leetcode_username: null,
    })
    .select()
    .single();

  return data.id;
}
