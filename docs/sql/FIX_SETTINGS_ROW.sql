-- ══════════════════════════════════════════════════════════════════════════
-- FIX: Create Settings Row for Your User
-- ══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to fix "Failed to save settings" error
-- ══════════════════════════════════════════════════════════════════════════

-- Step 1: Check if your user exists
SELECT id, email FROM users WHERE email = 'devanshgoyal7344@gmail.com';

-- Step 2: Create settings row for your user (if it doesn't exist)
INSERT INTO settings (user_id, timezone, daily_revision_limit, leetcode_username)
SELECT id, 'UTC', 6, NULL
FROM users 
WHERE email = 'devanshgoyal7344@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Verify settings row was created
SELECT * FROM settings 
WHERE user_id = (SELECT id FROM users WHERE email = 'devanshgoyal7344@gmail.com');

-- ══════════════════════════════════════════════════════════════════════════
-- EXPECTED RESULT:
-- ══════════════════════════════════════════════════════════════════════════
-- You should see 1 row with:
--   - user_id: (your UUID)
--   - timezone: UTC
--   - daily_revision_limit: 6
--   - leetcode_username: NULL (will be filled when you enter it)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- ══════════════════════════════════════════════════════════════════════════
-- 1. Go to: https://supabase.com/dashboard
-- 2. Select project: rbddecjzztgpdfyjfbmh
-- 3. Click "SQL Editor" → "New query"
-- 4. Copy-paste this entire file
-- 5. Click "Run"
-- 6. You should see your settings row created ✅
-- 7. Go back to your app and try saving LeetCode username again
-- ══════════════════════════════════════════════════════════════════════════
