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

  try {
    // Get user's solves first
    const { data: userSolves } = await supabaseServer
      .from("solves")
      .select("id")
      .eq("user_id", userId);

    const solveIds = (userSolves || []).map(s => s.id);

    // Get counts
    const { count: questionsCount } = await supabaseServer
      .from("questions")
      .select("*", { count: "exact", head: true });

    const solvesCount = userSolves?.length || 0;

    let revisionsCount = 0;
    if (solveIds.length > 0) {
      const { count } = await supabaseServer
        .from("revisions")
        .select("*", { count: "exact", head: true })
        .in("solve_id", solveIds);
      revisionsCount = count || 0;
    }

    // Estimate storage usage
    // Average sizes (in bytes):
    // - Question: ~500 bytes (title, slug, url, difficulty, tags)
    // - Solve: ~200 bytes (user_id, question_id, solved_at, code if stored)
    // - Revision: ~100 bytes (solve_id, stage, due_on, status)
    
    const questionSize = (questionsCount || 0) * 500;
    const solveSize = solvesCount * 200;
    const revisionSize = revisionsCount * 100;
    
    const totalBytes = questionSize + solveSize + revisionSize;
    const totalKB = totalBytes / 1024;
    const totalMB = totalKB / 1024;

    // Supabase free tier: 500 MB
    const freeTierMB = 500;
    const usedPercentage = (totalMB / freeTierMB) * 100;
    const remainingMB = freeTierMB - totalMB;

    // Calculate how many more problems can be stored
    // Each problem = 1 question + 1 solve + 3 revisions
    // = 500 + 200 + (3 * 100) = 1000 bytes = 1 KB per problem
    const bytesPerProblem = 1000;
    const remainingBytes = remainingMB * 1024 * 1024;
    const remainingProblems = Math.floor(remainingBytes / bytesPerProblem);

    return Response.json({
      counts: {
        questions: questionsCount || 0,
        solves: solvesCount,
        revisions: revisionsCount,
      },
      storage: {
        usedMB: parseFloat(totalMB.toFixed(2)),
        totalMB: freeTierMB,
        remainingMB: parseFloat(remainingMB.toFixed(2)),
        usedPercentage: parseFloat(usedPercentage.toFixed(2)),
      },
      capacity: {
        currentProblems: solvesCount,
        maxProblems: Math.floor(freeTierMB * 1024), // ~500,000 problems
        remainingProblems: remainingProblems,
      },
    });
  } catch (error) {
    console.error("[Database Usage] Error:", error);
    return Response.json({ error: "Failed to fetch database usage." }, { status: 500 });
  }
}
