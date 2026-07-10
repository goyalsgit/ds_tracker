export type LeetCodeSubmission = {
  title: string;
  titleSlug: string;
  timestamp: number;
  statusDisplay: string;
};

export type LeetCodeStats = {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
};

export type LeetCodeQuestionDetail = {
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topicTags: Array<{ name: string; slug: string }>;
};

export type LeetCodeProfile = {
  username: string;
  stats: LeetCodeStats;
  recentSubmissions: LeetCodeSubmission[];
};

const LEETCODE_ENDPOINT = "https://leetcode.com/graphql";

export async function fetchLeetCodeProfile(
  username: string,
  limit = 50
): Promise<LeetCodeProfile> {
  const query = `query userProfile($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
    recentAcSubmissionList(username: $username, limit: $limit) {
      title
      titleSlug
      timestamp
      statusDisplay
    }
  }`;

  const response = await fetch(LEETCODE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Referer": "https://leetcode.com",
    },
    body: JSON.stringify({
      query,
      variables: { username, limit },
    }),
  });

  if (!response.ok) {
    throw new Error("LeetCode request failed.");
  }

  const data = (await response.json()) as {
    data?: {
      matchedUser: {
        username: string;
        submitStats: {
          acSubmissionNum: Array<{ difficulty: string; count: number }>;
        };
      } | null;
      recentAcSubmissionList: LeetCodeSubmission[];
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw new Error(data.errors[0].message);
  }

  if (!data.data?.matchedUser) {
    throw new Error("LeetCode user not found or profile is private.");
  }

  const counts = data.data.matchedUser.submitStats.acSubmissionNum;
  const totalSolved = counts.find((item) => item.difficulty === "All")?.count ?? 0;
  const easySolved = counts.find((item) => item.difficulty === "Easy")?.count ?? 0;
  const mediumSolved = counts.find((item) => item.difficulty === "Medium")?.count ?? 0;
  const hardSolved = counts.find((item) => item.difficulty === "Hard")?.count ?? 0;

  return {
    username: data.data.matchedUser.username,
    stats: { totalSolved, easySolved, mediumSolved, hardSolved },
    recentSubmissions: data.data.recentAcSubmissionList ?? [],
  };
}

export async function fetchQuestionDetail(
  titleSlug: string
): Promise<LeetCodeQuestionDetail | null> {
  const query = `query questionDetail($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      difficulty
      topicTags {
        name
        slug
      }
    }
  }`;

  try {
    const response = await fetch(LEETCODE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data?: {
        question: {
          difficulty: string;
          topicTags: Array<{ name: string; slug: string }>;
        } | null;
      };
    };

    const q = data.data?.question;
    if (!q) return null;

    return {
      titleSlug,
      difficulty: (q.difficulty as "Easy" | "Medium" | "Hard") ?? "Medium",
      topicTags: q.topicTags ?? [],
    };
  } catch {
    return null;
  }
}
