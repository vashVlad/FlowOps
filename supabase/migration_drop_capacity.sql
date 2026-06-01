-- Run in Supabase SQL Editor to remove the rack capacity column from zones.
ALTER TABLE zones DROP COLUMN IF EXISTS capacity;
