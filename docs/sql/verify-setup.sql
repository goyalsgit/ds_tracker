-- Verify your setup is complete
-- Run in Supabase SQL Editor

-- 1. Check user exists
SELECT 'USER' as check_type, id, email, created_at 
FROM users 
WHERE email = 'devanshgoyal7344@gmail.com';

-- 2. Check settings exists
SELECT 'SETTINGS' as check_type, user_id, leetcode_username, created_at
FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');

-- 3. Check how many solves you have
SELECT 'SOLVES_COUNT' as check_type, COUNT(*) as total
FROM solves 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');

-- 4. Check most recent solve
SELECT 'LATEST_SOLVE' as check_type, q.title, s.solved_at
FROM solves s
JOIN questions q ON s.question_id = q.id
WHERE s.user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com')
ORDER BY s.solved_at DESC
LIMIT 1;
