create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text,
  source_url text,
  difficulty text,
  tags text[] default '{}',
  patterns text[] default '{}',
  companies text[] default '{}',
  last_solved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  solved_at timestamptz not null,
  source text default 'manual',
  notes text,
  code text,
  language text default 'cpp',
  solve_time_minutes integer,
  is_bookmarked boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists revisions (
  id uuid primary key default gen_random_uuid(),
  solve_id uuid not null references solves(id) on delete cascade,
  stage integer not null,
  due_on date not null,
  status text not null default 'scheduled',
  completed_at timestamptz,
  outcome text,
  time_taken_minutes integer,
  difficulty_rating integer,
  created_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references revisions(id) on delete cascade,
  provider text not null default 'google',
  external_id text,
  event_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expiry_date bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  timezone text default 'UTC',
  daily_revision_limit integer default 6,
  leetcode_username text,
  leetcode_session text,   -- LeetCode LEETCODE_SESSION cookie for fetching submitted code
  intervals jsonb,
  created_at timestamptz not null default now()
);

create index if not exists revisions_due_on_idx on revisions(due_on);
create index if not exists solves_user_id_idx on solves(user_id);
create index if not exists questions_title_idx on questions(title);
create index if not exists questions_last_solved_at_idx on questions(last_solved_at desc);
create index if not exists users_auth_user_id_idx on users(auth_user_id);
create unique index if not exists google_tokens_user_id_unique on google_tokens(user_id);
create unique index if not exists settings_user_id_unique on settings(user_id);
create unique index if not exists questions_slug_unique on questions(slug);
create unique index if not exists solves_user_question_unique on solves(user_id, question_id);

-- ── AI summaries cache ────────────────────────────────────────────────────
-- Caches Gemini responses so we don't re-call the API for the same problem.
-- This saves tokens and makes the UI instant on repeat views.
-- TO SWITCH TO LOCAL: replace this table with a SQLite table (same schema).
create table if not exists ai_summaries (
  id uuid primary key default gen_random_uuid(),
  question_slug text not null unique,
  summary text,
  hint text,
  generated_at timestamptz not null default now()
);

create index if not exists ai_summaries_slug_idx on ai_summaries(question_slug);

-- ── Content Library (Learn Tab) ───────────────────────────────────────────
-- Personal DSA encyclopedia: store problems by topic with solutions.
create table if not exists content_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  topic text not null,
  sub_topic text,
  title text not null,
  question_text text,
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  code_solution text not null,
  language text not null default 'cpp',
  explanation text,
  intuition text,
  time_complexity text,
  space_complexity text,
  tags text[] default '{}',
  source_url text,
  is_favorite boolean default false,
  view_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_library_user_id_idx on content_library(user_id);
create index if not exists content_library_topic_idx on content_library(user_id, topic);
create index if not exists content_library_difficulty_idx on content_library(user_id, difficulty);
create index if not exists content_library_favorite_idx on content_library(user_id, is_favorite) where is_favorite = true;

create or replace function update_content_library_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger if not exists update_content_library_timestamp
  before update on content_library
  for each row execute function update_content_library_timestamp();

-- ── Streak tracking view ──────────────────────────────────────────────────
-- Computed in application code (see /api/ai/analysis/route.ts).
-- No separate table needed — derived from revisions.completed_at.
