-- Migration: Consolidate to Operational Notes only
-- Migrates existing rack.notes + delivery.notes into rack_notes, then drops columns.
-- Safe to run: INSERT is filtered to non-empty values only.

-- 1. Preserve existing rack notes
INSERT INTO rack_notes (rack_id, note, pinned, created_at)
SELECT id, trim(notes), true, now()
FROM racks
WHERE notes IS NOT NULL AND trim(notes) <> '';

-- 2. Preserve existing delivery notes
INSERT INTO rack_notes (delivery_id, note, pinned, created_at)
SELECT id, trim(notes), true, now()
FROM deliveries
WHERE notes IS NOT NULL AND trim(notes) <> '';

-- 3. Drop columns
ALTER TABLE racks     DROP COLUMN IF EXISTS notes;
ALTER TABLE deliveries DROP COLUMN IF EXISTS notes;
