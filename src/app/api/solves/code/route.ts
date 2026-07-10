import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * PATCH /api/solves/code
 * Save C++ code for a solved problem
 */
export async function PATCH(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    solveId?: string;
    code?: string;
    language?: string;
  };

  const solveId = body.solveId?.trim();
  const code = body.code?.trim() ?? "";
  const language = body.language?.trim() ?? "cpp";

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

  // Update code
  const { error } = await supabaseServer
    .from("solves")
    .update({ code, language })
    .eq("id", solveId);

  if (error) {
    return Response.json({ error: "Failed to save code." }, { status: 500 });
  }

  return Response.json({ ok: true, solveId, language });
}

/**
 * GET /api/solves/code?solveId=xxx
 * Get code for a solve
 */
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const solveId = url.searchParams.get("solveId");

  if (!solveId) {
    return Response.json({ error: "solveId required." }, { status: 400 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { data: solve } = await supabaseServer
    .from("solves")
    .select("code, language")
    .eq("id", solveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!solve) {
    return Response.json({ error: "Solve not found." }, { status: 404 });
  }

  return Response.json({
    code: solve.code ?? "",
    language: solve.language ?? "cpp",
  });
}
