import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/analytics
 * Get comprehensive analytics for the user
 * - Topic mastery (% per topic)
 * - Difficulty progression (weekly)
 * - Overall stats
 * - All FREE - uses Supabase views
 */
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  // Get topic mastery
  const { data: topicMastery } = await supabaseServer
    .from("topic_mastery")
    .select("*")
    .eq("user_id", userId)
    .order("problems_solved", { ascending: false });

  // Get difficulty progression (last 12 weeks)
  const { data: difficultyProgression } = await supabaseServer
    .from("difficulty_progression")
    .select("*")
    .eq("user_id", userId)
    .limit(12);

  // Get overall analytics
  const { data: analytics } = await supabaseServer
    .from("user_analytics")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Get bookmarked problems
  const { data: bookmarked } = await supabaseServer
    .from("solves")
    .select(`
      id,
      solved_at,
      solve_time_minutes,
      questions!inner(title, difficulty, tags, source_url)
    `)
    .eq("user_id", userId)
    .eq("is_bookmarked", true)
    .order("solved_at", { ascending: false });

  return Response.json({
    topicMastery: topicMastery ?? [],
    difficultyProgression: difficultyProgression ?? [],
    analytics: analytics ?? {
      total_problems: 0,
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      avg_solve_time: null,
      bookmarked_count: 0,
      total_revisions_done: 0,
      total_revisions_failed: 0,
      overall_success_rate: null,
    },
    bookmarked: bookmarked ?? [],
  });
}
