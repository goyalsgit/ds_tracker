-- ══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Check Your Database State
-- ══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to see what's in your database
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Check if your user exists
SELECT 'USER CHECK' as type, * FROM users WHERE email = 'devanshgoyal7344@gmail.com';

-- 2. Check if settings row exists for your user
SELECT 'SETTINGS CHECK' as type, s.* 
FROM settings s
WHERE s.user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');

-- 3. Check if unique index exists on settings
SELECT 'INDEX CHECK' as type, indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'settings' AND indexname = 'settings_user_id_unique';

-- ══════════════════════════════════════════════════════════════════════════
-- EXPECTED RESULTS:
-- ══════════════════════════════════════════════════════════════════════════
-- USER CHECK: Should show 1 row with your email
-- SETTINGS CHECK: Should show 1 row with your user_id
-- INDEX CHECK: Should show 1 row with the unique index
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- IF SETTINGS CHECK SHOWS 0 ROWS:
-- ══════════════════════════════════════════════════════════════════════════
-- Run this to create the settings row:

INSERT INTO settings (user_id, timezone, daily_revision_limit, leetcode_username)
SELECT id, 'UTC', 6, NULL
FROM users 
WHERE email = 'devanshgoyal7344@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Then verify:
SELECT * FROM settings WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');
-- ══════════════════════════════════════════════════════════════════════════
