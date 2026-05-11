-- Migration: Item count per rack
-- Allows manual entry of estimated item count (integer, optional)

ALTER TABLE racks
  ADD COLUMN IF NOT EXISTS item_count integer CHECK (item_count IS NULL OR item_count >= 0);
