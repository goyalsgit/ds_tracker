export async function GET() {
  return Response.json({
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasSupabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
