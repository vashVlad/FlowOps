-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Zone Redesign Migration
-- Run in the Supabase SQL editor if you already have the old A1/A2/B1/B2/C1/OVF
-- zones in your database and want to migrate to the G1–G6 / W1–W7 layout.
--
-- If you are setting up fresh, just run schema.sql → seed.sql instead.
-- ════════════════════════════════════════════════════════════════════════════

-- Step 1: Insert the 7 new warehouse zones (G zones reuse existing UUIDs below)
INSERT INTO zones (id, name, label, capacity) VALUES
  ('11111111-1111-1111-1111-111111111107', 'W1', 'Receiving dock',   12),
  ('11111111-1111-1111-1111-111111111108', 'W2', 'Dock B',           12),
  ('11111111-1111-1111-1111-111111111109', 'W3', 'Unpacking bay',    15),
  ('11111111-1111-1111-1111-111111111110', 'W4', 'Lotting A',        18),
  ('11111111-1111-1111-1111-111111111111', 'W5', 'Lotting B',        18),
  ('11111111-1111-1111-1111-111111111112', 'W6', 'Ready staging A',  25),
  ('11111111-1111-1111-1111-111111111113', 'W7', 'Ready staging B',  25)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Re-map rack zone assignments (old zone → semantically equivalent new zone)
--   A1 (receiving dock)  → W1
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111107' WHERE zone_id = '11111111-1111-1111-1111-111111111101';
--   A2 (unpacking area)  → W3
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111109' WHERE zone_id = '11111111-1111-1111-1111-111111111102';
--   B1 (lotting tables)  → W4
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111110' WHERE zone_id = '11111111-1111-1111-1111-111111111103';
--   B2 (ready staging)   → W6
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111112' WHERE zone_id = '11111111-1111-1111-1111-111111111104';
--   C1 (pickup area)     → G1  (items awaiting collection go into gallery)
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111101' WHERE zone_id = '11111111-1111-1111-1111-111111111105';
--   OVF (overflow)       → W7
UPDATE racks SET zone_id = '11111111-1111-1111-1111-111111111113' WHERE zone_id = '11111111-1111-1111-1111-111111111106';

-- Step 3: Rename the 6 existing zones to their new Gallery identities
UPDATE zones SET name = 'G1', label = 'Gallery A',  capacity = 35   WHERE id = '11111111-1111-1111-1111-111111111101';
UPDATE zones SET name = 'G2', label = 'Gallery B',  capacity = 35   WHERE id = '11111111-1111-1111-1111-111111111102';
UPDATE zones SET name = 'G3', label = 'Gallery C',  capacity = 35   WHERE id = '11111111-1111-1111-1111-111111111103';
UPDATE zones SET name = 'G4', label = 'Gallery D',  capacity = 35   WHERE id = '11111111-1111-1111-1111-111111111104';
UPDATE zones SET name = 'G5', label = 'Gallery E',  capacity = 25   WHERE id = '11111111-1111-1111-1111-111111111105';
UPDATE zones SET name = 'G6', label = 'Gallery F',  capacity = 25   WHERE id = '11111111-1111-1111-1111-111111111106';
