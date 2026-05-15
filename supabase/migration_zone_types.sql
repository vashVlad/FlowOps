-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Zone Auction Color Migration
-- Adds auction_color (hex) to zones table.
-- When set on a zone, the dashboard cell shows the auction style + color dot.
-- Run in Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS auction_color text;

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS reserved boolean NOT NULL DEFAULT false;

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS auction_date text; -- YYYY-MM-DD, for auction zones without a linked delivery
