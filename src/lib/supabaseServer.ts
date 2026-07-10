/**
 * ── Supabase Server Client ─────────────────────────────────────────────────
 *
 * CURRENT MODE: Supabase (cloud PostgreSQL)
 *
 * TO SWITCH TO LOCAL SQLite (future):
 *   1. Install: npm install better-sqlite3 @types/better-sqlite3
 *   2. Create src/lib/db-local.ts with better-sqlite3 client
 *   3. Replace this file's export with the SQLite equivalent
 *   4. All API routes use getSupabaseServer() — just swap the implementation
 *
 * TO SWITCH BACK TO SUPABASE:
 *   1. Ensure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are in .env.local
 *   2. Restore this file (it's in git history)
 *   3. Run: npm run dev
 *
 * The auth layer (authServer.ts) always uses Supabase Auth regardless of
 * which database you use for data — Google OAuth requires Supabase Auth.
 */
import "server-only";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Using `any` for the database generic so all table operations type-check
// without requiring a generated types file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

let cachedClient: AnySupabaseClient | null = null;

export function getSupabaseServer(): AnySupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
    throw new Error(
      "Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, (supabaseServiceKey ?? supabaseAnonKey)!) as AnySupabaseClient;
  }

  return cachedClient;
}
