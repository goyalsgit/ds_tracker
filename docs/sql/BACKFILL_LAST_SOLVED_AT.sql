-- ══════════════════════════════════════════════════════════════════════════════
-- BACKFILL last_solved_at FOR EXISTING QUESTIONS
-- ══════════════════════════════════════════════════════════════════════════════
-- This script updates the last_solved_at field for all existing questions
-- based on the most recent solve timestamp from the solves table.
--
-- Run this ONCE after deploying the fix to populate historical data.
-- ══════════════════════════════════════════════════════════════════════════════

-- Update last_solved_at for all questions based on their most recent solve
UPDATE questions q
SET last_solved_at = (
  SELECT MAX(s.solved_at)
  FROM solves s
  WHERE s.question_id = q.id
)
WHERE EXISTS (
  SELECT 1
  FROM solves s
  WHERE s.question_id = q.id
);

-- Verify the update
SELECT 
  COUNT(*) as total_questions,
  COUNT(last_solved_at) as questions_with_last_solved,
  COUNT(*) - COUNT(last_solved_at) as questions_without_last_solved
FROM questions;

-- Show sample of updated questions
SELECT 
  title,
  difficulty,
  last_solved_at,
  created_at
FROM questions
WHERE last_solved_at IS NOT NULL
ORDER BY last_solved_at DESC
LIMIT 10;
