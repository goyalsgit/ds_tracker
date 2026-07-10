-- Run in Supabase SQL Editor
-- Adds is_public column for shared/admin content in Learn tab

ALTER TABLE content_library ADD COLUMN IF NOT EXISTS is_public boolean default false;
CREATE INDEX IF NOT EXISTS content_library_public_idx ON content_library(is_public) WHERE is_public = true;
