-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Phase 10: Auction Cycle Archiving
-- Run in the Supabase SQL editor (once, on your live database).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE racks
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_racks_is_archived ON racks(is_archived);

-- Also update the RLS policy if you have authenticated-only policies enabled:
-- (Re-run your existing RLS policy DROP/CREATE block — no change needed, the
--  new column is covered automatically by the table-level policy.)
