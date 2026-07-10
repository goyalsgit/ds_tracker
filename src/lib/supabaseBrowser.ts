/**
 * ── Supabase Browser Client ────────────────────────────────────────────────
 *
 * Used ONLY for authentication (Google OAuth sign-in/sign-out).
 * Data fetching uses server-side API routes, not this client directly.
 *
 * IMPORTANT: Do NOT replace this with a local alternative.
 * Google OAuth requires Supabase Auth regardless of where you store data.
 *
 * If Supabase is unavailable:
 *   - Auth will fail (user can't sign in)
 *   - Fix: restore NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *     in .env.local and restart the dev server
 */
import { createClient } from "@supabase/supabase-js";

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase client env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return cachedClient;
}