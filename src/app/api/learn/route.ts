import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

/**
 * GET /api/learn
 * Fetch all content library entries for the authenticated user
 */
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic");
  const difficulty = searchParams.get("difficulty");
  const search = searchParams.get("search");

  let query = supabaseServer
    .from("content_library")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (topic && topic !== "All") {
    query = query.eq("topic", topic);
  }

  if (difficulty && difficulty !== "All") {
    query = query.eq("difficulty", difficulty);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,question_text.ilike.%${search}%`);
  }

  const { data: entries, error } = await query;

  if (error) {
    return Response.json({ error: "Failed to load content library." }, { status: 500 });
  }

  // Get unique topics for filter
  const { data: allEntries } = await supabaseServer
    .from("content_library")
    .select("topic")
    .eq("user_id", userId);

  const topics = [...new Set(allEntries?.map(e => e.topic) ?? [])].sort();

  return Response.json({ entries: entries ?? [], topics });
}

/**
 * POST /api/learn
 * Create a new content library entry
 */
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const body = await request.json() as {
    topic: string;
    subTopic?: string;
    title: string;
    questionText?: string;
    difficulty?: string;
    codeSolution: string;
    language?: string;
    explanation?: string;
    intuition?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    tags?: string[];
    sourceUrl?: string;
  };

  if (!body.topic || !body.title || !body.codeSolution) {
    return Response.json({ error: "Topic, title, and code solution are required." }, { status: 400 });
  }

  const { data: entry, error } = await supabaseServer
    .from("content_library")
    .insert({
      user_id: userId,
      topic: body.topic,
      sub_topic: body.subTopic ?? null,
      title: body.title,
      question_text: body.questionText ?? null,
      difficulty: body.difficulty ?? null,
      code_solution: body.codeSolution,
      language: body.language ?? "cpp",
      explanation: body.explanation ?? null,
      intuition: body.intuition ?? null,
      time_complexity: body.timeComplexity ?? null,
      space_complexity: body.spaceComplexity ?? null,
      tags: body.tags ?? [],
      source_url: body.sourceUrl ?? null,
    })
    .select()
    .single();

  if (error || !entry) {
    console.error("[Learn POST error]", error);
    return Response.json({ error: error?.message ?? "Failed to create entry." }, { status: 500 });
  }

  return Response.json({ entry });
}

/**
 * PUT /api/learn
 * Update an existing content library entry
 */
export async function PUT(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const body = await request.json() as {
    id: string;
    topic?: string;
    subTopic?: string;
    title?: string;
    questionText?: string;
    difficulty?: string;
    codeSolution?: string;
    language?: string;
    explanation?: string;
    intuition?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    tags?: string[];
    sourceUrl?: string;
    isFavorite?: boolean;
  };

  if (!body.id) {
    return Response.json({ error: "Entry ID is required." }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.topic !== undefined) updateData.topic = body.topic;
  if (body.subTopic !== undefined) updateData.sub_topic = body.subTopic;
  if (body.title !== undefined) updateData.title = body.title;
  if (body.questionText !== undefined) updateData.question_text = body.questionText;
  if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;
  if (body.codeSolution !== undefined) updateData.code_solution = body.codeSolution;
  if (body.language !== undefined) updateData.language = body.language;
  if (body.explanation !== undefined) updateData.explanation = body.explanation;
  if (body.intuition !== undefined) updateData.intuition = body.intuition;
  if (body.timeComplexity !== undefined) updateData.time_complexity = body.timeComplexity;
  if (body.spaceComplexity !== undefined) updateData.space_complexity = body.spaceComplexity;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.sourceUrl !== undefined) updateData.source_url = body.sourceUrl;
  if (body.isFavorite !== undefined) updateData.is_favorite = body.isFavorite;

  const { data: entry, error } = await supabaseServer
    .from("content_library")
    .update(updateData)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !entry) {
    return Response.json({ error: "Failed to update entry." }, { status: 500 });
  }

  return Response.json({ entry });
}

/**
 * DELETE /api/learn
 * Delete a content library entry
 */
export async function DELETE(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Entry ID is required." }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("content_library")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return Response.json({ error: "Failed to delete entry." }, { status: 500 });
  }

  return Response.json({ success: true });
}
