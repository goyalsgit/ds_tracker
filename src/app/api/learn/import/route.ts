/**
 * POST /api/learn/import
 *
 * Imports a LeetCode problem into the content library form data.
 * Fetches: title, difficulty, tags, question content from LeetCode GraphQL.
 * Also checks if the user has an existing solve (to pull saved code).
 * Returns pre-filled form data — user can review/edit before saving.
 */
import { getAuthUserFromRequest } from "@/lib/authServer";
import { getOrCreateUserId } from "@/lib/userProfile";
import { getSupabaseServer } from "@/lib/supabaseServer";

// ─── Topic / Sub-topic mapping ─────────────────────────────────────────────
// Maps LeetCode topic tags → structured DSA topic + sub-topic
const TAG_MAP: Record<string, { topic: string; subTopic: string }> = {
  // Arrays
  "array":                    { topic: "Arrays",           subTopic: "Basics" },
  "matrix":                   { topic: "Arrays",           subTopic: "2D Matrix" },
  "prefix-sum":               { topic: "Arrays",           subTopic: "Prefix Sum" },
  "sliding-window":           { topic: "Arrays",           subTopic: "Sliding Window" },
  "two-pointers":             { topic: "Arrays",           subTopic: "Two Pointers" },
  "sorting":                  { topic: "Arrays",           subTopic: "Sorting" },
  "binary-search":            { topic: "Binary Search",    subTopic: "Classic" },
  // Strings
  "string":                   { topic: "Strings",          subTopic: "Basics" },
  "string-matching":          { topic: "Strings",          subTopic: "Pattern Matching" },
  // Hashing
  "hash-table":               { topic: "Hashing",          subTopic: "Hash Map" },
  "hash-function":            { topic: "Hashing",          subTopic: "Hash Function" },
  // Linked List
  "linked-list":              { topic: "Linked List",      subTopic: "Basics" },
  "doubly-linked-list":       { topic: "Linked List",      subTopic: "Doubly Linked" },
  // Stacks & Queues
  "stack":                    { topic: "Stack & Queue",    subTopic: "Stack" },
  "queue":                    { topic: "Stack & Queue",    subTopic: "Queue" },
  "monotonic-stack":          { topic: "Stack & Queue",    subTopic: "Monotonic Stack" },
  "monotonic-queue":          { topic: "Stack & Queue",    subTopic: "Monotonic Queue" },
  "deque":                    { topic: "Stack & Queue",    subTopic: "Deque" },
  // Trees
  "tree":                     { topic: "Trees",            subTopic: "Binary Tree" },
  "binary-tree":              { topic: "Trees",            subTopic: "Binary Tree" },
  "binary-search-tree":       { topic: "Trees",            subTopic: "BST" },
  "segment-tree":             { topic: "Trees",            subTopic: "Segment Tree" },
  "fenwick-tree":             { topic: "Trees",            subTopic: "Fenwick Tree" },
  "trie":                     { topic: "Trees",            subTopic: "Trie" },
  "n-ary-tree":               { topic: "Trees",            subTopic: "N-ary Tree" },
  // Graphs
  "graph":                    { topic: "Graphs",           subTopic: "General" },
  "depth-first-search":       { topic: "Graphs",           subTopic: "DFS" },
  "breadth-first-search":     { topic: "Graphs",           subTopic: "BFS" },
  "topological-sort":         { topic: "Graphs",           subTopic: "Topological Sort" },
  "shortest-path":            { topic: "Graphs",           subTopic: "Shortest Path" },
  "union-find":               { topic: "Graphs",           subTopic: "Union Find" },
  "minimum-spanning-tree":    { topic: "Graphs",           subTopic: "MST" },
  "strongly-connected-component": { topic: "Graphs",       subTopic: "SCC" },
  // Dynamic Programming
  "dynamic-programming":      { topic: "Dynamic Programming", subTopic: "General" },
  "memoization":              { topic: "Dynamic Programming", subTopic: "Memoization" },
  // Greedy
  "greedy":                   { topic: "Greedy",           subTopic: "General" },
  // Backtracking
  "backtracking":             { topic: "Backtracking",     subTopic: "General" },
  // Heap
  "heap-priority-queue":      { topic: "Heap",             subTopic: "Priority Queue" },
  // Math
  "math":                     { topic: "Math",             subTopic: "General" },
  "bit-manipulation":         { topic: "Bit Manipulation", subTopic: "General" },
  "number-theory":            { topic: "Math",             subTopic: "Number Theory" },
  // Recursion
  "recursion":                { topic: "Recursion",        subTopic: "General" },
  "divide-and-conquer":       { topic: "Recursion",        subTopic: "Divide & Conquer" },
  // Design
  "design":                   { topic: "Design",           subTopic: "General" },
  "data-stream":              { topic: "Design",           subTopic: "Data Stream" },
  // Intervals
  "intervals":                { topic: "Arrays",           subTopic: "Intervals" },
};

// Priority order: first tag with a mapping wins as primary topic
// Second matched tag provides sub-topic refinement
function mapTagsToTopicSubTopic(tags: string[]): { topic: string; subTopic: string } {
  for (const tag of tags) {
    const mapped = TAG_MAP[tag];
    if (mapped) return mapped;
  }
  // Fallback: capitalize first tag
  const first = tags[0] ?? "General";
  return {
    topic: first.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
    subTopic: "General",
  };
}

// ─── Fetch question content from LeetCode GraphQL ─────────────────────────
async function fetchLeetCodeQuestion(slug: string) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        difficulty
        content
        topicTags { name slug }
        hints
      }
    }
  `;
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://leetcode.com",
    },
    body: JSON.stringify({ query, variables: { titleSlug: slug } }),
  });
  if (!res.ok) return null;
  const data = await res.json() as {
    data?: {
      question: {
        title: string;
        titleSlug: string;
        difficulty: string;
        content: string;
        topicTags: Array<{ name: string; slug: string }>;
        hints: string[];
      } | null;
    };
  };
  return data.data?.question ?? null;
}

// Strip HTML tags from LeetCode content
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Extract slug from URL or use as-is
function extractSlug(input: string): string {
  const urlMatch = input.match(/leetcode\.com\/problems\/([^/]+)/);
  if (urlMatch) return urlMatch[1];
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json() as { slugOrUrl: string };
  if (!body.slugOrUrl?.trim()) {
    return Response.json({ error: "LeetCode URL or slug is required." }, { status: 400 });
  }

  const slug = extractSlug(body.slugOrUrl);

  // 1. Fetch from LeetCode
  const question = await fetchLeetCodeQuestion(slug);
  if (!question) {
    return Response.json({ error: `Could not find LeetCode problem: "${slug}". Check the URL or slug.` }, { status: 404 });
  }

  // 2. Map tags → DSA topic/sub-topic
  const tagSlugs = question.topicTags.map(t => t.slug);
  const tagNames = question.topicTags.map(t => t.name.toLowerCase());
  const { topic, subTopic } = mapTagsToTopicSubTopic(tagSlugs);

  // 3. Check if user has existing solve + code for this problem
  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();

  let existingCode = "";
  let existingLanguage = "cpp";

  const { data: existingQuestion } = await supabase
    .from("questions")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingQuestion) {
    const { data: solve } = await supabase
      .from("solves")
      .select("code, language")
      .eq("user_id", userId)
      .eq("question_id", existingQuestion.id)
      .maybeSingle();

    if (solve?.code) {
      existingCode = solve.code;
      existingLanguage = solve.language ?? "cpp";
    }
  }

  // 4. Clean question content
  const questionText = question.content ? stripHtml(question.content).slice(0, 2000) : "";

  return Response.json({
    // Pre-filled form data
    title: question.title,
    topic,
    subTopic,
    difficulty: question.difficulty,
    tags: tagNames,
    questionText,
    codeSolution: existingCode,
    language: existingLanguage,
    sourceUrl: `https://leetcode.com/problems/${slug}/`,
    // Meta
    alreadySolved: Boolean(existingCode),
    tagsMapped: tagSlugs,
  });
}
