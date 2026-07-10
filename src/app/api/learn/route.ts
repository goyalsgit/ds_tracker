import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

// Admin email — only this user can create/edit/delete public entries
const ADMIN_EMAIL = "devanshgoyal7344@gmail.com";

/**
 * GET /api/learn
 * Returns: public entries (visible to all) + user's private entries
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

  // Fetch: all public entries + user's own private entries
  let query = supabaseServer
    .from("content_library")
    .select("*")
    .or(`is_public.eq.true,user_id.eq.${userId}`)
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
    console.error("[Learn GET error]", error);
    return Response.json({ error: "Failed to load content library." }, { status: 500 });
  }

  // Get unique topics from visible entries
  const { data: allVisible } = await supabaseServer
    .from("content_library")
    .select("topic")
    .or(`is_public.eq.true,user_id.eq.${userId}`);

  const topics = [...new Set(allVisible?.map(e => e.topic) ?? [])].sort();

  return Response.json({
    entries: entries ?? [],
    topics,
    isAdmin: authUser.email === ADMIN_EMAIL,
  });
}

/**
 * POST /api/learn
 * Create a new content library entry
 * - Admin can create public entries (is_public: true)
 * - Regular users can only create private entries
 */
export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();
  const isAdmin = authUser.email === ADMIN_EMAIL;

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
    isPublic?: boolean;
  };

  if (!body.topic || !body.title || !body.codeSolution) {
    return Response.json({ error: "Topic, title, and code solution are required." }, { status: 400 });
  }

  // Only admin can make entries public
  const isPublic = isAdmin && body.isPublic === true;

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
      is_public: isPublic,
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
 * - Admin can edit any public entry
 * - Users can only edit their own private entries
 */
export async function PUT(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();
  const isAdmin = authUser.email === ADMIN_EMAIL;

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
    isPublic?: boolean;
  };

  if (!body.id) {
    return Response.json({ error: "Entry ID is required." }, { status: 400 });
  }

  // Check ownership: user owns it OR admin can edit public entries
  const { data: existing } = await supabaseServer
    .from("content_library")
    .select("user_id, is_public")
    .eq("id", body.id)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Entry not found." }, { status: 404 });
  }

  const canEdit = existing.user_id === userId || (isAdmin && existing.is_public);
  if (!canEdit) {
    return Response.json({ error: "You can only edit your own entries." }, { status: 403 });
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
  if (isAdmin && body.isPublic !== undefined) updateData.is_public = body.isPublic;

  const { data: entry, error } = await supabaseServer
    .from("content_library")
    .update(updateData)
    .eq("id", body.id)
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
 * - Admin can delete public entries
 * - Users can only delete their own private entries
 */
export async function DELETE(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = await getOrCreateUserId(authUser);
  const supabaseServer = getSupabaseServer();
  const isAdmin = authUser.email === ADMIN_EMAIL;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Entry ID is required." }, { status: 400 });
  }

  // Check ownership
  const { data: existing } = await supabaseServer
    .from("content_library")
    .select("user_id, is_public")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return Response.json({ error: "Entry not found." }, { status: 404 });
  }

  const canDelete = existing.user_id === userId || (isAdmin && existing.is_public);
  if (!canDelete) {
    return Response.json({ error: "You can only delete your own entries." }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("content_library")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: "Failed to delete entry." }, { status: 500 });
  }

  return Response.json({ success: true });
}
