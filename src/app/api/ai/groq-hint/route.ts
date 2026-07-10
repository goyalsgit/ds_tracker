/**
 * ── Groq Hint API ──────────────────────────────────────────────────────────
 * 
 * POST /api/ai/groq-hint
 * 
 * Ultra-fast hints using Groq (700+ tokens/second).
 * Falls back to Gemini if Groq fails.
 * 
 * Free tier: 14,400 requests/day, 6,000 tokens/minute
 */

import { generateGroqHint } from "@/lib/groq";
import { getRevisionHint } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      difficulty?: string;
      tags?: string[];
      stage?: number;
    };

    const { title, difficulty, tags, stage = 1 } = body;

    if (!title || !difficulty || !tags) {
      return Response.json(
        { error: "Missing required fields: title, difficulty, tags" },
        { status: 400 }
      );
    }

    console.log(`[Groq Hint] Generating hint for: ${title}`);

    try {
      // Try Groq first (ultra-fast)
      const hint = await generateGroqHint(title, difficulty, tags);
      console.log(`[Groq Hint] Success (Groq)`);
      return Response.json({ hint, provider: "groq" });
    } catch (groqError) {
      // Fallback to Gemini if Groq fails
      console.warn(`[Groq Hint] Groq failed, falling back to Gemini:`, groqError);
      const hint = await getRevisionHint(title, difficulty, tags, stage);
      console.log(`[Groq Hint] Success (Gemini fallback)`);
      return Response.json({ hint, provider: "gemini" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate hint";
    console.error("[Groq Hint] Error:", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
