/**
 * GET /api/daily-problem
 * Fetches today's LeetCode daily challenge from the free alfa-leetcode-api
 */
export async function GET() {
  try {
    const res = await fetch("https://alfa-leetcode-api.onrender.com/daily", {
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return Response.json({ error: "Failed to fetch daily problem" }, { status: 502 });
    }

    const data = await res.json();

    // Strip HTML from question text for clean display
    const cleanText = (data.question || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim()
      .slice(0, 500);

    return Response.json({
      title: data.questionTitle || "Daily Challenge",
      titleSlug: data.titleSlug || "",
      difficulty: data.difficulty || "Medium",
      date: data.date || new Date().toISOString().slice(0, 10),
      link: data.questionLink || `https://leetcode.com/problems/${data.titleSlug}/`,
      description: cleanText,
      topics: (data.topicTags || []).map((t: { name: string }) => t.name),
      hints: data.hints || [],
      examples: data.exampleTestcases || "",
    });
  } catch (err) {
    return Response.json({ error: "Network error fetching daily problem" }, { status: 500 });
  }
}
