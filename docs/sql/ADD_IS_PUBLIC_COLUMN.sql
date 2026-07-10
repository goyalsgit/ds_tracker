-- Run this in Supabase SQL Editor to fix the "is_public column not found" error
-- Dashboard: https://supabase.com/dashboard → Your Project → SQL Editor

-- Add is_public column to content_library if it doesn't exist
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Add view_count column if missing
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- Add updated_at column if missing
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add index for public entries (for faster queries)
CREATE INDEX IF NOT EXISTS content_library_public_idx 
ON content_library(is_public) WHERE is_public = true;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'content_library'
ORDER BY ordinal_position;
