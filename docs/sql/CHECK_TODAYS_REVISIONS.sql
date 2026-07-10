-- Check today's revisions
-- Run this in Supabase SQL Editor to see what's due today

-- 1. Check current date
SELECT CURRENT_DATE as today;

-- 2. Check all revisions for today
SELECT 
  r.id,
  r.solve_id,
  r.stage,
  r.due_on,
  r.status,
  q.title,
  q.difficulty,
  s.solved_at,
  s.code IS NOT NULL as has_code,
  s.language
FROM revisions r
JOIN solves s ON r.solve_id = s.id
JOIN questions q ON s.question_id = q.id
WHERE r.due_on = CURRENT_DATE
ORDER BY r.stage;

-- 3. Check upcoming revisions (next 7 days)
SELECT 
  r.due_on,
  COUNT(*) as revision_count
FROM revisions r
WHERE r.due_on >= CURRENT_DATE 
  AND r.due_on <= CURRENT_DATE + INTERVAL '7 days'
GROUP BY r.due_on
ORDER BY r.due_on;

-- 4. Check if there are any revisions at all
SELECT 
  COUNT(*) as total_revisions,
  COUNT(CASE WHEN due_on < CURRENT_DATE THEN 1 END) as overdue,
  COUNT(CASE WHEN due_on = CURRENT_DATE THEN 1 END) as today,
  COUNT(CASE WHEN due_on > CURRENT_DATE THEN 1 END) as future
FROM revisions;
