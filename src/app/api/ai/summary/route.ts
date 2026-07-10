/**
 * POST /api/ai/summary
 * Returns a 3-line problem summary for fast revision.
 *
 * Body: { title, difficulty, tags }
 * Returns: { summary: string }
 *
 * Uses Gemini 1.5 Flash (free: 1M tokens/day).
 * ~150 tokens per call → ~6,600 summaries/day free.
 */

import { getAuthUserFromRequest } from "@/lib/authServer";
import { getProblemSummary } from "@/lib/gemini";

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    difficulty?: string;
    tags?: string[];
  };

  if (!body.title) {
    return Response.json({ error: "title required." }, { status: 400 });
  }

  try {
    const summary = await getProblemSummary(
      body.title,
      body.difficulty ?? "Medium",
      body.tags ?? []
    );
    return Response.json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
