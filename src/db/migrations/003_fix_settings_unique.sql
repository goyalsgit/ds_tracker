-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Fix Settings Table - Add Unique Constraint
-- ══════════════════════════════════════════════════════════════════════════

-- Add unique constraint on user_id so upsert works properly
create unique index if not exists settings_user_id_unique on settings(user_id);

-- ══════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- ══════════════════════════════════════════════════════════════════════════
-- 1. Go to: https://supabase.com/dashboard
-- 2. Select project: rbddecjzztgpdfyjfbmh
-- 3. Click "SQL Editor" → "New query"
-- 4. Copy-paste this file
-- 5. Click "Run"
-- 6. Verify success ✅
-- ══════════════════════════════════════════════════════════════════════════

-- This fixes the "Failed to save settings" error
-- Now username will save properly!
