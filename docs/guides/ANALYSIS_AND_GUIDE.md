# Recommended Improvements

## 1. Usage Tracking Dashboard

Add a new table to track metrics:

```sql
-- Add to schema.sql
create table if not exists usage_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  problems_solved integer default 0,
  revisions_completed integer default 0,
  revisions_failed integer default 0,
  leetcode_syncs integer default 0,
  calendar_syncs integer default 0,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

create index usage_stats_user_date_idx on usage_stats(user_id, date);
```

Create API endpoint:
```typescript
// src/app/api/stats/route.ts
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();
  
  // Last 30 days stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: stats } = await supabase
    .from('usage_stats')
    .select('*')
    .eq('user_id', userId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });
  
  // Aggregate stats
  const totalSolved = stats?.reduce((sum, day) => sum + day.problems_solved, 0) ?? 0;
  const totalRevisions = stats?.reduce((sum, day) => sum + day.revisions_completed, 0) ?? 0;
  const totalFailed = stats?.reduce((sum, day) => sum + day.revisions_failed, 0) ?? 0;
  const successRate = totalRevisions > 0 
    ? ((totalRevisions / (totalRevisions + totalFailed)) * 100).toFixed(1)
    : 0;
  
  return Response.json({
    last30Days: {
      problemsSolved: totalSolved,
      revisionsCompleted: totalRevisions,
      revisionsFailed: totalFailed,
      successRate: `${successRate}%`
    },
    dailyBreakdown: stats
  });
}
```

## 2. Automatic Revision Recommendations

Add intelligent recommendations based on:
- Problems you frequently fail
- Topics you haven't practiced recently
- Difficulty progression

```typescript
// src/app/api/recommendations/route.ts
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();
  
  // Find problems with failed revisions
  const { data: failedRevisions } = await supabase
    .from('revisions')
    .select(`
      solve_id,
      solves!inner(
        question_id,
        questions!inner(title, slug, difficulty, tags, source_url)
      )
    `)
    .eq('solves.user_id', userId)
    .eq('outcome', 'failed')
    .order('completed_at', { ascending: false })
    .limit(10);
  
  // Find topics you haven't practiced in 14+ days
  const { data: staleTags } = await supabase.rpc('get_stale_topics', {
    p_user_id: userId,
    p_days: 14
  });
  
  return Response.json({
    needsReview: failedRevisions?.map(r => ({
      title: r.solves.questions.title,
      difficulty: r.solves.questions.difficulty,
      url: r.solves.questions.source_url,
      reason: 'Previously failed revision'
    })),
    staleTopics: staleTags?.map(tag => ({
      topic: tag.tag_name,
      daysSinceLastPractice: tag.days_since,
      problemCount: tag.problem_count
    }))
  });
}
```

## 3. Batch LeetCode Sync (Fetch All Problems)

Current limitation: Only fetches last 20 submissions

```typescript
// src/lib/leetcode.ts - Add full history fetch
export async function fetchAllLeetCodeSubmissions(
  username: string
): Promise<LeetCodeSubmission[]> {
  const allSubmissions: LeetCodeSubmission[] = [];
  let offset = 0;
  const limit = 20;
  let hasMore = true;
  
  while (hasMore) {
    const query = `query recentSubmissions($username: String!, $limit: Int!, $offset: Int!) {
      recentSubmissionList(username: $username, limit: $limit, offset: $offset) {
        title
        titleSlug
        timestamp
      }
    }`;
    
    const response = await fetch(LEETCODE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { username, limit, offset }
      })
    });
    
    const data = await response.json();
    const submissions = data.data?.recentSubmissionList ?? [];
    
    if (submissions.length === 0) {
      hasMore = false;
    } else {
      allSubmissions.push(...submissions);
      offset += limit;
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Safety: stop after 500 problems (10,000 is unrealistic)
    if (offset >= 500) break;
  }
  
  return allSubmissions;
}
```

## 4. Automated Daily Sync (Cron Job)

Use Vercel Cron Jobs (free on Hobby plan):

```typescript
// src/app/api/cron/daily-sync/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = getSupabaseServer();
  
  // Get all users with LeetCode username configured
  const { data: users } = await supabase
    .from('settings')
    .select('user_id, leetcode_username')
    .not('leetcode_username', 'is', null);
  
  const results = [];
  
  for (const user of users ?? []) {
    try {
      // Sync LeetCode for this user
      const profile = await fetchLeetCodeProfile(user.leetcode_username, 20);
      // ... sync logic ...
      results.push({ userId: user.user_id, status: 'success' });
    } catch (error) {
      results.push({ 
        userId: user.user_id, 
        status: 'failed',
        error: error.message 
      });
    }
  }
  
  return Response.json({ results });
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/daily-sync",
    "schedule": "0 2 * * *"
  }]
}
```

## 5. Revision Success Analytics

Track which problems you consistently fail:

```typescript
// src/app/api/analytics/weak-areas/route.ts
export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  const userId = await getOrCreateUserId(authUser);
  const supabase = getSupabaseServer();
  
  // Problems with >50% failure rate
  const { data: weakProblems } = await supabase.rpc('get_weak_problems', {
    p_user_id: userId,
    p_min_revisions: 2
  });
  
  return Response.json({ weakProblems });
}
```

Add SQL function:
```sql
create or replace function get_weak_problems(p_user_id uuid, p_min_revisions int)
returns table (
  question_title text,
  total_revisions bigint,
  failed_revisions bigint,
  failure_rate numeric
) as $$
begin
  return query
  select 
    q.title,
    count(r.id) as total_revisions,
    count(r.id) filter (where r.outcome = 'failed') as failed_revisions,
    round(
      count(r.id) filter (where r.outcome = 'failed')::numeric / 
      count(r.id)::numeric * 100, 
      1
    ) as failure_rate
  from revisions r
  join solves s on r.solve_id = s.id
  join questions q on s.question_id = q.id
  where s.user_id = p_user_id
    and r.status = 'completed'
  group by q.id, q.title
  having count(r.id) >= p_min_revisions
    and count(r.id) filter (where r.outcome = 'failed')::numeric / count(r.id)::numeric > 0.5
  order by failure_rate desc;
end;
$$ language plpgsql;
```
