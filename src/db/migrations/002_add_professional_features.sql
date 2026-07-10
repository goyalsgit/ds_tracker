-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Add Professional DSA Prep Features (All FREE!)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Add solve time tracking ────────────────────────────────────────────
alter table solves add column if not exists solve_time_minutes integer;
alter table solves add column if not exists is_bookmarked boolean default false;

-- ── 2. Add pattern/category to questions ──────────────────────────────────
alter table questions add column if not exists patterns text[] default '{}';
alter table questions add column if not exists companies text[] default '{}';

-- ── 3. Add revision performance tracking ──────────────────────────────────
alter table revisions add column if not exists time_taken_minutes integer;
alter table revisions add column if not exists difficulty_rating integer; -- 1-5 (how hard user found it)

-- ── 4. Create indexes for better performance ──────────────────────────────
create index if not exists solves_bookmarked_idx on solves(user_id, is_bookmarked) where is_bookmarked = true;
create index if not exists questions_patterns_idx on questions using gin(patterns);
create index if not exists questions_companies_idx on questions using gin(companies);
create index if not exists revisions_outcome_idx on revisions(outcome) where outcome is not null;

-- ── 5. Create topic mastery view ──────────────────────────────────────────
-- This helps calculate mastery % per topic
create or replace view topic_mastery as
select 
  s.user_id,
  unnest(q.tags) as topic,
  count(distinct s.id) as problems_solved,
  count(distinct r.id) filter (where r.status = 'done') as revisions_completed,
  count(distinct r.id) filter (where r.status = 'failed') as revisions_failed,
  round(
    count(distinct r.id) filter (where r.status = 'done')::numeric / 
    nullif(count(distinct r.id) filter (where r.status in ('done', 'failed'))::numeric, 0) * 100,
    1
  ) as success_rate
from solves s
join questions q on s.question_id = q.id
left join revisions r on r.solve_id = s.id and r.status != 'scheduled'
group by s.user_id, unnest(q.tags);

-- ── 6. Create difficulty progression view ─────────────────────────────────
create or replace view difficulty_progression as
select 
  s.user_id,
  date_trunc('week', s.solved_at) as week,
  count(*) filter (where q.difficulty = 'Easy') as easy_count,
  count(*) filter (where q.difficulty = 'Medium') as medium_count,
  count(*) filter (where q.difficulty = 'Hard') as hard_count
from solves s
join questions q on s.question_id = q.id
group by s.user_id, date_trunc('week', s.solved_at)
order by week desc;

-- ── 7. Create analytics summary view ──────────────────────────────────────
create or replace view user_analytics as
select 
  s.user_id,
  count(distinct s.id) as total_problems,
  count(distinct s.id) filter (where q.difficulty = 'Easy') as easy_solved,
  count(distinct s.id) filter (where q.difficulty = 'Medium') as medium_solved,
  count(distinct s.id) filter (where q.difficulty = 'Hard') as hard_solved,
  avg(s.solve_time_minutes) filter (where s.solve_time_minutes is not null) as avg_solve_time,
  count(distinct s.id) filter (where s.is_bookmarked = true) as bookmarked_count,
  count(distinct r.id) filter (where r.status = 'done') as total_revisions_done,
  count(distinct r.id) filter (where r.status = 'failed') as total_revisions_failed,
  round(
    count(distinct r.id) filter (where r.status = 'done')::numeric / 
    nullif(count(distinct r.id) filter (where r.status in ('done', 'failed'))::numeric, 0) * 100,
    1
  ) as overall_success_rate
from solves s
join questions q on s.question_id = q.id
left join revisions r on r.solve_id = s.id
group by s.user_id;

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS TO APPLY THIS MIGRATION:
-- ══════════════════════════════════════════════════════════════════════════
-- 1. Go to Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project: rbddecjzztgpdfyjfbmh
-- 3. Click "SQL Editor" → "New query"
-- 4. Copy-paste this entire file
-- 5. Click "Run"
-- 6. Verify success ✅
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS (ALL FREE!):
-- ══════════════════════════════════════════════════════════════════════════
-- ✅ Solve time tracking (how long you took)
-- ✅ Bookmark problems (favorites)
-- ✅ Pattern tagging (Sliding Window, Two Pointers, etc.)
-- ✅ Company tagging (Google, Amazon, etc.)
-- ✅ Revision difficulty rating (how hard you found it)
-- ✅ Topic mastery view (% mastery per topic)
-- ✅ Difficulty progression view (track improvement)
-- ✅ Analytics summary view (all stats in one place)
-- ══════════════════════════════════════════════════════════════════════════
