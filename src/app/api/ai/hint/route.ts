/**
 * POST /api/ai/hint
 * Returns a memory-trigger hint for a revision attempt.
 *
 * Body: { title, difficulty, tags, stage }
 * Returns: { hint: string }
 *
 * Uses Gemini 1.5 Flash (free: 1M tokens/day).
 * ~200 tokens per call → ~5,000 hints/day free.
 */

import { getAuthUserFromRequest } from "@/lib/authServer";
import { getRevisionHint } from "@/lib/gemini";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    difficulty?: string;
    tags?: string[];
    stage?: number;
  };

  if (!body.title) {
    return Response.json({ error: "title required." }, { status: 400 });
  }

  try {
    const hint = await getRevisionHint(
      body.title,
      body.difficulty ?? "Medium",
      body.tags ?? [],
      body.stage ?? 1
    );
    return Response.json({ hint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
