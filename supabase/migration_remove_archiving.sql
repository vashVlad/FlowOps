-- ════════════════════════════════════════════════════════════════════════════
-- Removes the "Close Auction Cycle" archiving feature.
-- Run in the Supabase SQL editor (once, on your live database).
-- Reverses supabase/migration_archiving.sql.
-- ════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_racks_is_archived;

ALTER TABLE racks
  DROP COLUMN IF EXISTS is_archived;
