-- Run this in Supabase SQL Editor to add the missing intuition column
-- and clean up any constraint issues on your existing content_library table

-- 1. Add the intuition column (safe - does nothing if already exists)
ALTER TABLE content_library ADD COLUMN IF NOT EXISTS intuition text;

-- 2. Make sure difficulty has NO check constraint (so it accepts any value or null)
-- First drop the constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'content_library' AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE content_library DROP CONSTRAINT IF EXISTS content_library_difficulty_check;
  END IF;
END $$;

-- 3. Verify the table structure looks correct
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'content_library'
ORDER BY ordinal_position;
