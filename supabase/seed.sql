-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Seed Data
-- Run AFTER schema.sql in the Supabase SQL editor.
-- Safe to re-run — all inserts use ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Zones ─────────────────────────────────────────────────────────────────────

INSERT INTO zones (id, name, label, capacity) VALUES
  -- Gallery (G1–G4 top row, PU/G5/G6 second row)
  ('11111111-1111-1111-1111-111111111101', 'G1', 'Gallery A',        35),
  ('11111111-1111-1111-1111-111111111102', 'G2', 'Gallery B',        35),
  ('11111111-1111-1111-1111-111111111103', 'G3', 'Gallery C',        35),
  ('11111111-1111-1111-1111-111111111104', 'G4', 'Gallery D',        35),
  ('11111111-1111-1111-1111-111111111114', 'PU', 'Pick Up',          16),
  ('11111111-1111-1111-1111-111111111105', 'G5', 'Gallery E',        25),
  ('11111111-1111-1111-1111-111111111106', 'G6', 'Gallery F',        25),
  -- Warehouse (W1–W3 top, W6/W7/W4 second row, W5 right column)
  ('11111111-1111-1111-1111-111111111107', 'W1', 'Receiving dock',   12),
  ('11111111-1111-1111-1111-111111111108', 'W2', 'Dock B',           12),
  ('11111111-1111-1111-1111-111111111109', 'W3', 'Unpacking bay',    15),
  ('11111111-1111-1111-1111-111111111112', 'W6', 'Ready staging A',  25),
  ('11111111-1111-1111-1111-111111111113', 'W7', 'Ready staging B',  25),
  ('11111111-1111-1111-1111-111111111110', 'W4', 'Lotting A',        18),
  ('11111111-1111-1111-1111-111111111111', 'W5', 'Lotting B',        18),
  -- Other zones
  ('11111111-1111-1111-1111-111111111115', 'B',  'Bidding floor',   NULL),
  ('11111111-1111-1111-1111-111111111116', 'H',  'Holding',          30),
  ('11111111-1111-1111-1111-111111111117', 'C',  'Cataloguing',      25)
ON CONFLICT (id) DO NOTHING;


-- ── Deliveries ────────────────────────────────────────────────────────────────

INSERT INTO deliveries
  (id, delivery_code, consigner_name, expected_rack_count, type, status,
   scheduled_date, arrived_at, notes, created_at, updated_at)
VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    'DEL-0001', 'Martin & Sons', 4, 'scheduled', 'processing',
    CURRENT_DATE - 1,
    NOW() - INTERVAL '4 hours',
    NULL,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '4 hours'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'DEL-0002', 'Greenfield Estate', 3, 'walkin', 'processing',
    CURRENT_DATE - 8,
    NOW() - INTERVAL '8 days',
    NULL,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    'DEL-0003', 'Harlow Antiques', 3, 'scheduled', 'scheduled',
    CURRENT_DATE + INTERVAL '2 days',
    NULL,
    'Large furniture items — confirm unloading bay availability',
    NOW() - INTERVAL '48 hours',
    NOW() - INTERVAL '48 hours'
  )
ON CONFLICT (id) DO NOTHING;


-- ── Racks ─────────────────────────────────────────────────────────────────────

INSERT INTO racks
  (id, rack_code, consigner_name, status, priority,
   zone_id, delivery_id, created_at, updated_at)
VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    'RC-0038', 'Martin & Sons', 'unpacking', 'high',
    '11111111-1111-1111-1111-111111111109',   -- W3 Unpacking bay
    '22222222-2222-2222-2222-222222222201',   -- DEL-0001
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '3 hours'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'RC-0041', 'Martin & Sons', 'lotting', 'normal',
    '11111111-1111-1111-1111-111111111110',   -- W4 Lotting A
    '22222222-2222-2222-2222-222222222201',   -- DEL-0001
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '3 hours 30 minutes'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'RC-0042', 'Greenfield Estate', 'ready', 'normal',
    '11111111-1111-1111-1111-111111111112',   -- W6 Ready staging A
    '22222222-2222-2222-2222-222222222202',   -- DEL-0002
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;


-- ── Rack events ───────────────────────────────────────────────────────────────

INSERT INTO rack_events (id, rack_id, from_status, to_status, created_at) VALUES
  -- RC-0038: intake → unpacking (3h ago)
  (
    '44444444-4444-4444-4444-444444444401',
    '33333333-3333-3333-3333-333333333301',
    'intake', 'unpacking',
    NOW() - INTERVAL '3 hours'
  ),
  -- RC-0041: intake → unpacking → sorting → lotting
  (
    '44444444-4444-4444-4444-444444444402',
    '33333333-3333-3333-3333-333333333302',
    'intake', 'unpacking',
    NOW() - INTERVAL '3 hours 45 minutes'
  ),
  (
    '44444444-4444-4444-4444-444444444403',
    '33333333-3333-3333-3333-333333333302',
    'unpacking', 'sorting',
    NOW() - INTERVAL '3 hours 30 minutes'
  ),
  -- RC-0041 passed through sorting quickly (sorted in ~10 minutes, just for seed realism)
  -- Entered lotting 3.5h ago
  (
    '44444444-4444-4444-4444-444444444404',
    '33333333-3333-3333-3333-333333333302',
    'sorting', 'lotting',
    NOW() - INTERVAL '3 hours 30 minutes'
  ),
  -- RC-0042: intake → unpacking → sorting → lotting → ready (entered ready 5d ago)
  (
    '44444444-4444-4444-4444-444444444405',
    '33333333-3333-3333-3333-333333333303',
    'intake', 'unpacking',
    NOW() - INTERVAL '7 days 22 hours'
  ),
  (
    '44444444-4444-4444-4444-444444444406',
    '33333333-3333-3333-3333-333333333303',
    'unpacking', 'sorting',
    NOW() - INTERVAL '7 days 16 hours'
  ),
  (
    '44444444-4444-4444-4444-444444444407',
    '33333333-3333-3333-3333-333333333303',
    'sorting', 'lotting',
    NOW() - INTERVAL '5 days 4 hours'
  ),
  (
    '44444444-4444-4444-4444-444444444408',
    '33333333-3333-3333-3333-333333333303',
    'lotting', 'ready',
    NOW() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;


-- ── Advance sequences past seed data ──────────────────────────────────────────

SELECT setval('delivery_code_seq', 3, true);  -- next: DEL-0004
SELECT setval('rack_code_seq',    42, true);  -- next: RC-0043
