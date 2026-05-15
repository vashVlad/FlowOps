-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Simplified Pipeline Migration
-- Run this in the Supabase SQL editor (once, in order).
-- Pipeline change: intake + unpacking + sorting → unpacking_sorting
-- New checkpoint: sorted (between unpacking_sorting and lotting)
--
-- NOTE: Constraints must be dropped BEFORE migrating data, because the old
-- constraint rejects the new status values ('unpacking_sorting', 'sorted').
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Drop old constraints first (before touching any data) ─────────────────

ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_status_check;

ALTER TABLE rack_events DROP CONSTRAINT IF EXISTS rack_events_from_status_check;
ALTER TABLE rack_events DROP CONSTRAINT IF EXISTS rack_events_to_status_check;

-- ── 2. Migrate existing rack data ─────────────────────────────────────────────

UPDATE racks
SET status = 'unpacking_sorting'
WHERE status IN ('intake', 'unpacking', 'sorting');

-- ── 3. Migrate rack_events history ───────────────────────────────────────────

UPDATE rack_events
SET from_status = 'unpacking_sorting'
WHERE from_status IN ('intake', 'unpacking', 'sorting');

UPDATE rack_events
SET to_status = 'unpacking_sorting'
WHERE to_status IN ('intake', 'unpacking', 'sorting');

-- ── 4. Add new constraints ────────────────────────────────────────────────────

ALTER TABLE racks ADD CONSTRAINT racks_status_check
  CHECK (status IN ('unpacking_sorting', 'sorted', 'lotting', 'ready', 'pickup', 'completed'));
ALTER TABLE racks ALTER COLUMN status SET DEFAULT 'unpacking_sorting';

ALTER TABLE rack_events ADD CONSTRAINT rack_events_from_status_check
  CHECK (from_status IN ('unpacking_sorting', 'sorted', 'lotting', 'ready', 'pickup', 'completed'));

ALTER TABLE rack_events ADD CONSTRAINT rack_events_to_status_check
  CHECK (to_status IN ('unpacking_sorting', 'sorted', 'lotting', 'ready', 'pickup', 'completed'));

-- ── 5. Verify ─────────────────────────────────────────────────────────────────

-- Should return 0 rows if migration succeeded:
-- SELECT id, status FROM racks WHERE status IN ('intake', 'unpacking', 'sorting');
-- SELECT id, from_status, to_status FROM rack_events
--   WHERE from_status IN ('intake','unpacking','sorting')
--      OR to_status   IN ('intake','unpacking','sorting');
