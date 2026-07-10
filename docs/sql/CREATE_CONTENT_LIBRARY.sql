-- ══════════════════════════════════════════════════════════════════════════════
-- CONTENT LIBRARY - Personal DSA Learning Platform
-- ══════════════════════════════════════════════════════════════════════════════
-- This table stores your curated collection of DSA problems with solutions.
-- Like a personal W3Schools - organize problems by topic with solutions.
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists content_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  
  -- Organization
  topic text not null,                    -- e.g., "Arrays", "Trees", "DP"
  sub_topic text,                         -- e.g., "Sliding Window", "Binary Search"
  
  -- Problem details
  title text not null,
  question_text text,                     -- Full question description
  difficulty text check (difficulty in ('Easy', 'Medium', 'Hard')),
  
  -- Solution
  code_solution text not null,            -- C++ solution code
  language text not null default 'cpp',
  explanation text,                       -- Approach explanation
  intuition text,                         -- Key insight/trick
  
  -- Complexity
  time_complexity text,                   -- e.g., "O(n log n)"
  space_complexity text,                  -- e.g., "O(n)"
  
  -- Metadata
  tags text[] default '{}',
  source_url text,
  is_favorite boolean default false,
  view_count integer default 0,
  
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists content_library_user_id_idx on content_library(user_id);
create index if not exists content_library_topic_idx on content_library(user_id, topic);
create index if not exists content_library_title_idx on content_library(user_id, title);
create index if not exists content_library_favorite_idx on content_library(user_id, is_favorite) where is_favorite = true;
create index if not exists content_library_difficulty_idx on content_library(user_id, difficulty);

-- Auto-update timestamp
create or replace function update_content_library_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_content_library_timestamp
  before update on content_library
  for each row
  execute function update_content_library_timestamp();

-- Verify the table
select 
  count(*) as total_entries,
  count(distinct topic) as unique_topics,
  count(distinct user_id) as unique_users
from content_library;
