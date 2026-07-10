/**
 * ── Groq AI Client ─────────────────────────────────────────────────────────
 * 
 * Ultra-fast LLM API using Llama 3.3 70B at 700+ tokens/second.
 * 
 * Free tier limits (as of 2026):
 *   - 14,400 requests per day
 *   - 6,000 tokens per minute
 *   - No credit card required
 * 
 * Use for:
 *   - Quick hints (faster than Gemini)
 *   - Fast summaries
 *   - Coding help
 * 
 * Fallback to Gemini for:
 *   - Complex reasoning
 *   - Long documents
 *   - Multimodal tasks
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqResponse = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

/**
 * Generate a quick hint using Groq (ultra-fast)
 */
export async function generateGroqHint(
  title: string,
  difficulty: string,
  tags: string[]
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const prompt = `You are a DSA mentor. Give a SHORT hint (2-3 sentences) for solving this problem:

Problem: ${title}
Difficulty: ${difficulty}
Topics: ${tags.join(", ")}

Hint should:
- Point to the key insight WITHOUT giving away the solution
- Mention the data structure or algorithm pattern
- Be encouraging and concise

Format: Just the hint text, no extra formatting.`;

  const messages: GroqMessage[] = [
    {
      role: "system",
      content: "You are a helpful DSA mentor who gives concise, insightful hints.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = (await response.json()) as GroqResponse;
  return data.choices[0]?.message?.content || "No hint available.";
}

/**
 * Generate a quick summary using Groq (ultra-fast)
 */
export async function generateGroqSummary(
  title: string,
  difficulty: string,
  tags: string[]
): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const prompt = `Create a CONCISE summary for this DSA problem:

Problem: ${title}
Difficulty: ${difficulty}
Topics: ${tags.join(", ")}

Include:
1. Key concept (1 sentence)
2. Approach (2-3 sentences)
3. Time/Space complexity

Keep it SHORT and actionable.`;

  const messages: GroqMessage[] = [
    {
      role: "system",
      content: "You are a DSA expert who creates concise, practical summaries.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.5,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = (await response.json()) as GroqResponse;
  return data.choices[0]?.message?.content || "No summary available.";
}
