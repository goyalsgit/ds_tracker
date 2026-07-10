-- Run this in Supabase SQL Editor
-- Adds leetcode_session column to settings table for fetching submitted code

ALTER TABLE settings ADD COLUMN IF NOT EXISTS leetcode_session text;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'settings' ORDER BY ordinal_position;
