-- Check what's in your database
-- Run this in Supabase SQL Editor

-- 1. Count total solves for your user
SELECT COUNT(*) as total_solves
FROM solves s
JOIN users u ON s.user_id = u.id
WHERE u.email = 'devanshgoyal7344@gmail.com';

-- 2. Show recent 10 solves
SELECT 
  q.title,
  q.difficulty,
  s.solved_at,
  s.source
FROM solves s
JOIN questions q ON s.question_id = q.id
JOIN users u ON s.user_id = u.id
WHERE u.email = 'devanshgoyal7344@gmail.com'
ORDER BY s.solved_at DESC
LIMIT 10;

-- 3. Check if today's problems are in database
SELECT 
  q.title,
  s.solved_at
FROM solves s
JOIN questions q ON s.question_id = q.id
JOIN users u ON s.user_id = u.id
WHERE u.email = 'devanshgoyal7344@gmail.com'
  AND q.title IN ('Rotate Function', 'Course Schedule')
ORDER BY s.solved_at DESC;
