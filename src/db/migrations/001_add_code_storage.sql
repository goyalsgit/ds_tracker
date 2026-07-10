-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Add code storage and last solved tracking
-- ══════════════════════════════════════════════════════════════════════════

-- Add code column to solves table to store C++ solutions
alter table solves add column if not exists code text;

-- Add language column to track programming language (cpp, python, java, etc.)
alter table solves add column if not exists language text default 'cpp';

-- Add last_solved_at to questions for quick "last solved" lookup
-- This is denormalized for performance (avoids JOIN on every query)
alter table questions add column if not exists last_solved_at timestamptz;

-- Create index for faster last_solved_at queries
create index if not exists questions_last_solved_at_idx on questions(last_solved_at desc);

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS TO APPLY THIS MIGRATION:
-- ══════════════════════════════════════════════════════════════════════════
-- 1. Go to your Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project: rbddecjzztgpdfyjfbmh
-- 3. Click "SQL Editor" in left sidebar
-- 4. Click "New query"
-- 5. Copy-paste this entire file
-- 6. Click "Run" (or press Cmd/Ctrl + Enter)
-- 7. Verify success message appears
-- ══════════════════════════════════════════════════════════════════════════

-- Update existing questions with last_solved_at from their most recent solve
update questions q
set last_solved_at = (
  select max(s.solved_at)
  from solves s
  where s.question_id = q.id
)
where exists (
  select 1 from solves s where s.question_id = q.id
);

-- Create trigger to auto-update last_solved_at when new solve is added
create or replace function update_question_last_solved()
returns trigger as $$
begin
  update questions
  set last_solved_at = NEW.solved_at
  where id = NEW.question_id
    and (last_solved_at is null or last_solved_at < NEW.solved_at);
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_question_last_solved on solves;
create trigger trigger_update_question_last_solved
  after insert on solves
  for each row
  execute function update_question_last_solved();

-- ══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run these after migration to verify):
-- ══════════════════════════════════════════════════════════════════════════
-- Check if columns were added:
-- select column_name, data_type from information_schema.columns 
-- where table_name = 'solves' and column_name in ('code', 'language');
--
-- Check if last_solved_at was populated:
-- select title, last_solved_at from questions where last_solved_at is not null limit 5;
-- ══════════════════════════════════════════════════════════════════════════
