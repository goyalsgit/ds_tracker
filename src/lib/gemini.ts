/**
 * ── Gemini AI Integration ──────────────────────────────────────────────────
 *
 * Uses Google Gemini (free tier via Google AI Studio):
 *   - Free tier: 15 requests/minute, 1500 requests/day
 *   - No credit card required
 *
 * IMPORTANT — Get your key from the RIGHT place:
 *   ✅ https://aistudio.google.com/app/apikey  ← USE THIS (Google AI Studio)
 *   ❌ https://console.cloud.google.com        ← NOT THIS (Google Cloud)
 *
 * The Google Cloud key has limit:0 on free tier.
 * The AI Studio key has full free quota.
 *
 * Setup:
 *   1. Go to https://aistudio.google.com/app/apikey
 *   2. Click "Create API Key" → choose "Create API key in new project"
 *   3. Copy the key (starts with AIzaSy...)
 *   4. Replace GEMINI_API_KEY in .env.local
 *   5. Restart: npm run dev
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Model fallback chain — tries each until one works
// gemini-2.0-flash: 1500 req/day free (primary — best for daily use)
// gemini-2.5-flash: 20 req/day free (use sparingly — better quality)
// Switch order if you want 2.5 Flash quality over 2.0 Flash quantity
const MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your-gemini-api-key-here") {
    throw new Error("GEMINI_API_KEY_NOT_SET");
  }
  return new GoogleGenerativeAI(key);
}

async function generate(prompt: string): Promise<string> {
  const genAI = getClient();
  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message;
      // quota exhausted, model not found, or limit:0 key -> try next model
      if (msg.includes("429") || msg.includes("404") || msg.includes("not found") || msg.includes("limit: 0")) {
        continue;
      }
      throw lastError;
    }
  }

  // All models failed — give a clear actionable message
  const errMsg = lastError?.message ?? "";
  if (errMsg.includes("limit: 0")) {
    throw new Error(
      "KEY_FROM_CLOUD: Your key was created from Google Cloud Console (limit:0). " +
      "Go to https://aistudio.google.com/app/apikey and create a new key there instead."
    );
  }
  if (errMsg.includes("429")) {
    throw new Error("QUOTA_EXHAUSTED: Daily quota used up. Resets at midnight Pacific time. Try again tomorrow.");
  }
  throw lastError ?? new Error("All Gemini models failed");
}

/**
 * Full DSA problem breakdown for revision — includes working code.
 * Called when user clicks "AI Summary" or "Export PDF".
 */
export async function getProblemSummary(
  title: string,
  difficulty: string,
  tags: string[]
): Promise<string> {
  const prompt = `You are an expert DSA tutor creating a revision sheet for a student.

Problem: "${title}"
Difficulty: ${difficulty}
Topics: ${tags.join(", ") || "general DSA"}

Create a complete revision sheet with EXACTLY these sections (use these exact labels):

CONCEPT:
What core pattern/data structure this uses. (2 sentences max)

INTUITION:
The mental model — how to think about this problem from scratch. (3 sentences max)

KEY TRICK:
The single insight that unlocks the solution. (1-2 sentences)

APPROACH:
Numbered steps in plain English. No code here. (4-6 steps)

CODE:
Write clean, well-commented solution code in C++. Include time/space complexity as comments at the top. Use clear variable names. Show the optimal solution.

COMPLEXITY:
Time: O(...) — brief reason
Space: O(...) — brief reason

COMMON MISTAKES:
- Mistake 1
- Mistake 2
- Mistake 3

REMEMBER:
One short memorable phrase to recall this solution instantly.

Be thorough but concise. The code section must be complete and runnable.`;

  return generate(prompt);
}

/**
 * Hint for revision attempt — triggers memory without spoiling.
 * Stage-aware: early stages get stronger hints, later stages get nudges only.
 */
export async function getRevisionHint(
  title: string,
  difficulty: string,
  tags: string[],
  stage: number
): Promise<string> {
  const hintStrength =
    stage <= 1 ? "Give a moderately strong hint — they just learned this." :
    stage === 2 ? "Give a gentle hint — they've seen this once before." :
    stage === 3 ? "Give a minimal nudge — they should mostly remember." :
    "Give just a tiny memory trigger — they should know this well by now.";

  const prompt = `You are helping a student recall a DSA problem during spaced repetition revision.

Problem: "${title}"
Difficulty: ${difficulty}
Topics: ${tags.join(", ") || "general DSA"}
Revision Stage: ${stage}/5 — ${hintStrength}

Give ONE focused hint that helps them recall the solution approach.
Rules:
- NO code whatsoever
- NO full solution
- Just the key insight or first step to think about
- Be specific to THIS problem, not generic advice
- Maximum 3 sentences

Plain text only.`;

  return generate(prompt);
}

/**
 * Analyze weak areas from failed/overdue revisions.
 */
export async function getWeakAreaAnalysis(
  failedProblems: Array<{
    title: string;
    tags: string[];
    difficulty: string;
    failCount: number;
  }>
): Promise<string> {
  if (failedProblems.length === 0) {
    return "No failed revisions yet — great work! Keep completing your daily queue to build a strong foundation.";
  }

  const problemList = failedProblems
    .slice(0, 10)
    .map(
      (p) =>
        `- "${p.title}" (${p.difficulty}, topics: ${p.tags.join(", ") || "general"}, failed ${p.failCount}x)`
    )
    .join("\n");

  const prompt = `You are a DSA coach reviewing a student's revision performance.

Problems they struggled with most:
${problemList}

Provide a focused analysis (4-5 sentences total):
1. Identify the 1-2 topic patterns they struggle with most
2. Explain WHY these topics are typically hard
3. Give one specific concept or technique they should review
4. Suggest a concrete practice strategy

Be direct, specific, and encouraging. Plain text only, no markdown.`;

  return generate(prompt);
}

/**
 * Personalized daily study plan.
 */
export async function getDailyPlan(input: {
  todayRevisionCount: number;
  pendingTopics: string[];
  recentFailedTopics: string[];
  streak: number;
}): Promise<string> {
  const prompt = `You are a DSA study coach giving a student their daily briefing.

Today's stats:
- Revisions due today: ${input.todayRevisionCount}
- Topics in today's queue: ${input.pendingTopics.slice(0, 5).join(", ") || "none yet"}
- Topics they recently struggled with: ${input.recentFailedTopics.slice(0, 3).join(", ") || "none"}
- Current streak: ${input.streak} day${input.streak !== 1 ? "s" : ""}

Write a 2-3 sentence daily plan that:
1. Acknowledges their streak and today's workload
2. Gives specific advice based on their weak topics
3. Ends with a motivating action item

Be warm, specific, and practical. Plain text only.`;

  return generate(prompt);
}

// Backwards-compatibility alias: some older code imported
// `generateGeminiHint`. Export it as an alias to `getRevisionHint`.
export const generateGeminiHint = getRevisionHint;
