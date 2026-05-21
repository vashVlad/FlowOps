-- Add per-rack auction date (independent of delivery auction date)
ALTER TABLE racks ADD COLUMN IF NOT EXISTS auction_date DATE;
