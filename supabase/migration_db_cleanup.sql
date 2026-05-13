-- Migration: DB cleanup
-- Drops columns removed from the application layer.

-- racks.item_count was removed from all app code; drop the column.
ALTER TABLE racks DROP COLUMN IF EXISTS item_count;
