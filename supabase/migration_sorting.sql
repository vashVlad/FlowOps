-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Add "sorting" status
-- Run in the Supabase SQL editor on your existing database.
-- If setting up fresh, just run schema.sql — this migration is not needed.
-- ════════════════════════════════════════════════════════════════════════════

-- racks.status constraint
ALTER TABLE racks DROP CONSTRAINT IF EXISTS racks_status_check;
ALTER TABLE racks ADD CONSTRAINT racks_status_check
  CHECK (status IN ('intake', 'unpacking', 'sorting', 'lotting', 'ready', 'pickup', 'completed'));

-- rack_events.from_status constraint
ALTER TABLE rack_events DROP CONSTRAINT IF EXISTS rack_events_from_status_check;
ALTER TABLE rack_events ADD CONSTRAINT rack_events_from_status_check
  CHECK (from_status IN ('intake', 'unpacking', 'sorting', 'lotting', 'ready', 'pickup', 'completed'));

-- rack_events.to_status constraint
ALTER TABLE rack_events DROP CONSTRAINT IF EXISTS rack_events_to_status_check;
ALTER TABLE rack_events ADD CONSTRAINT rack_events_to_status_check
  CHECK (to_status IN ('intake', 'unpacking', 'sorting', 'lotting', 'ready', 'pickup', 'completed'));
