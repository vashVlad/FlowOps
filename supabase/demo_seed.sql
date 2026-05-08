-- ════════════════════════════════════════════════════════════════════════════
-- FlowOps V2 — Realistic Demo Seed
-- Run AFTER seed.sql in the Supabase SQL editor.
-- Safe to re-run — cleanup block below removes previous demo data first.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Cleanup: remove any previously seeded demo data ───────────────────────────
-- Deletes by delivery_code so it works regardless of which UUID version was used.

DELETE FROM rack_events
  WHERE rack_id IN (
    SELECT r.id FROM racks r
    JOIN deliveries d ON r.delivery_id = d.id
    WHERE d.delivery_code IN (
      'DEL-0004','DEL-0005','DEL-0006','DEL-0007',
      'DEL-0008','DEL-0009','DEL-0010','DEL-0011'
    )
  );

DELETE FROM racks
  WHERE delivery_id IN (
    SELECT id FROM deliveries
    WHERE delivery_code IN (
      'DEL-0004','DEL-0005','DEL-0006','DEL-0007',
      'DEL-0008','DEL-0009','DEL-0010','DEL-0011'
    )
  );

DELETE FROM deliveries
  WHERE delivery_code IN (
    'DEL-0004','DEL-0005','DEL-0006','DEL-0007',
    'DEL-0008','DEL-0009','DEL-0010','DEL-0011'
  );

-- Also clean up new-format demo racks/events in case of a partial previous run
DELETE FROM rack_events
  WHERE id::text LIKE '44444444-0000-0000-0000-%';

DELETE FROM rack_events
  WHERE rack_id IN (
    SELECT id FROM racks
    WHERE rack_code >= 'RC-0043' AND rack_code <= 'RC-0083'
  );

DELETE FROM racks
  WHERE rack_code >= 'RC-0043' AND rack_code <= 'RC-0083';

DELETE FROM racks
  WHERE id::text LIKE '33333333-0000-0000-0000-%';


-- ── Deliveries (DEL-0004 to DEL-0011) ────────────────────────────────────────

INSERT INTO deliveries
  (id, delivery_code, consigner_name, expected_rack_count, type, status,
   scheduled_date, arrived_at, completed_at, notes, created_at, updated_at)
VALUES
  ('22222222-0000-0000-0000-000000000004',
   'DEL-0004', 'Hargrove Estate', 10, 'scheduled', 'processing',
   CURRENT_DATE - 12, NOW() - INTERVAL '10 days', NULL,
   'Large house clearance — mixed antiques and furniture',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days'),

  ('22222222-0000-0000-0000-000000000005',
   'DEL-0005', 'Whitmore Antiques', 16, 'scheduled', 'processing',
   CURRENT_DATE - 30, NOW() - INTERVAL '28 days', NULL,
   'Quarterly auction batch — coordinating pickup schedule with buyer',
   NOW() - INTERVAL '32 days', NOW() - INTERVAL '28 days'),

  ('22222222-0000-0000-0000-000000000006',
   'DEL-0006', 'Pemberton & Co.', 6, 'scheduled', 'processing',
   CURRENT_DATE - 8, NOW() - INTERVAL '7 days', NULL,
   'Mixed furniture and collectibles',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '7 days'),

  ('22222222-0000-0000-0000-000000000007',
   'DEL-0007', 'Crown Walk-in', 0, 'walkin', 'processing',
   CURRENT_DATE - 2, NOW() - INTERVAL '2 days', NULL, NULL,
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),

  ('22222222-0000-0000-0000-000000000008',
   'DEL-0008', 'Blackwood Furniture', 4, 'walkin', 'complete',
   CURRENT_DATE - 14, NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days',
   NULL, NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),

  ('22222222-0000-0000-0000-000000000009',
   'DEL-0009', 'Fernwood Estates', 5, 'scheduled', 'processing',
   CURRENT_DATE - 11, NOW() - INTERVAL '9 days', NULL,
   'Large estate — complex mixed categories requiring extra cataloguing time',
   NOW() - INTERVAL '11 days', NOW() - INTERVAL '9 days'),

  ('22222222-0000-0000-0000-000000000010',
   'DEL-0010', 'Sterling Collections', 4, 'scheduled', 'arrived',
   CURRENT_DATE, NOW() - INTERVAL '3 hours', NULL,
   'Pre-sorted by category on arrival — fast-track sorting expected',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 hours'),

  ('22222222-0000-0000-0000-000000000011',
   'DEL-0011', 'Caldwell House', 10, 'scheduled', 'scheduled',
   CURRENT_DATE + 5, NULL, NULL,
   'Large Victorian house — request extra sorting staff on intake day',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')

ON CONFLICT (id) DO NOTHING;


-- ── Racks ─────────────────────────────────────────────────────────────────────

INSERT INTO racks
  (id, rack_code, consigner_name, status, priority, zone_id, delivery_id, created_at, updated_at)
VALUES

-- ── Sorting (7 racks) ─────────────────────────────────────────────────────────
-- Classification: 2 critical (>7d), 2 blocked (Hargrove + unpacking RC-0077), 2 warning (>5d), 1 healthy

  -- CRITICAL · HIGH priority (9d in sorting) — Fernwood
  ('33333333-0000-0000-0000-000000000043', 'RC-0043', 'Fernwood Estates', 'sorting', 'high',
   '11111111-1111-1111-1111-111111111117', '22222222-0000-0000-0000-000000000009',
   NOW() - INTERVAL '10 days 4 hours', NOW() - INTERVAL '9 days'),

  -- CRITICAL (8d in sorting) — Pemberton
  ('33333333-0000-0000-0000-000000000044', 'RC-0044', 'Pemberton & Co.', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111117', '22222222-0000-0000-0000-000000000006',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days'),

  -- BLOCKED (6d in sorting, DEL-0004 has RC-0077 still in unpacking) — Hargrove
  ('33333333-0000-0000-0000-000000000045', 'RC-0045', 'Hargrove Estate', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111117', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days'),

  -- BLOCKED (5d 6h in sorting, same delivery) — Hargrove
  ('33333333-0000-0000-0000-000000000046', 'RC-0046', 'Hargrove Estate', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111117', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days 6 hours'),

  -- WARNING (6d in sorting) — Fernwood
  ('33333333-0000-0000-0000-000000000047', 'RC-0047', 'Fernwood Estates', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111116', '22222222-0000-0000-0000-000000000009',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '6 days'),

  -- WARNING (5d 5h in sorting) — Pemberton
  ('33333333-0000-0000-0000-000000000048', 'RC-0048', 'Pemberton & Co.', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111116', '22222222-0000-0000-0000-000000000006',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days 5 hours'),

  -- HEALTHY (2d in sorting) — Pemberton
  ('33333333-0000-0000-0000-000000000049', 'RC-0049', 'Pemberton & Co.', 'sorting', 'normal',
   '11111111-1111-1111-1111-111111111116', '22222222-0000-0000-0000-000000000006',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days'),

-- ── Lotting (5 racks, 1.5–4h each — healthy, no alert) ───────────────────────

  ('33333333-0000-0000-0000-000000000050', 'RC-0050', 'Crown Walk-in', 'lotting', 'normal',
   '11111111-1111-1111-1111-111111111110', '22222222-0000-0000-0000-000000000007',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '3 hours 30 minutes'),

  ('33333333-0000-0000-0000-000000000051', 'RC-0051', 'Crown Walk-in', 'lotting', 'normal',
   '11111111-1111-1111-1111-111111111110', '22222222-0000-0000-0000-000000000007',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 hours'),

  -- Hargrove rack that finally cleared sorting after long delay
  ('33333333-0000-0000-0000-000000000052', 'RC-0052', 'Hargrove Estate', 'lotting', 'normal',
   '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 hours'),

  -- Fernwood rack that finally cleared sorting
  ('33333333-0000-0000-0000-000000000053', 'RC-0053', 'Fernwood Estates', 'lotting', 'normal',
   '11111111-1111-1111-1111-111111111111', '22222222-0000-0000-0000-000000000009',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 hours'),

  ('33333333-0000-0000-0000-000000000054', 'RC-0054', 'Crown Walk-in', 'lotting', 'normal',
   '11111111-1111-1111-1111-111111111110', '22222222-0000-0000-0000-000000000007',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 hour 30 minutes'),

-- ── Ready (5 racks, 5–8d — healthy expected wait) ─────────────────────────────

  ('33333333-0000-0000-0000-000000000055', 'RC-0055', 'Hargrove Estate', 'ready', 'normal',
   '11111111-1111-1111-1111-111111111112', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '11 days', NOW() - INTERVAL '7 days'),

  ('33333333-0000-0000-0000-000000000056', 'RC-0056', 'Hargrove Estate', 'ready', 'normal',
   '11111111-1111-1111-1111-111111111112', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '6 days'),

  ('33333333-0000-0000-0000-000000000057', 'RC-0057', 'Hargrove Estate', 'ready', 'normal',
   '11111111-1111-1111-1111-111111111113', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '8 days'),

  ('33333333-0000-0000-0000-000000000058', 'RC-0058', 'Whitmore Antiques', 'ready', 'normal',
   '11111111-1111-1111-1111-111111111112', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '5 days'),

  ('33333333-0000-0000-0000-000000000059', 'RC-0059', 'Whitmore Antiques', 'ready', 'normal',
   '11111111-1111-1111-1111-111111111113', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '6 days'),

-- ── Pickup (16 racks — triggers OVERLOADED ≥ 16) ─────────────────────────────

  ('33333333-0000-0000-0000-000000000060', 'RC-0060', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '21 days'),
  ('33333333-0000-0000-0000-000000000061', 'RC-0061', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '21 days'),
  ('33333333-0000-0000-0000-000000000062', 'RC-0062', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days'),
  ('33333333-0000-0000-0000-000000000063', 'RC-0063', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '20 days'),
  ('33333333-0000-0000-0000-000000000064', 'RC-0064', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '19 days'),
  ('33333333-0000-0000-0000-000000000065', 'RC-0065', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '19 days'),
  ('33333333-0000-0000-0000-000000000066', 'RC-0066', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '18 days'),
  ('33333333-0000-0000-0000-000000000067', 'RC-0067', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '18 days'),
  ('33333333-0000-0000-0000-000000000068', 'RC-0068', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '17 days'),
  ('33333333-0000-0000-0000-000000000069', 'RC-0069', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '17 days'),
  ('33333333-0000-0000-0000-000000000070', 'RC-0070', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '16 days'),
  ('33333333-0000-0000-0000-000000000071', 'RC-0071', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '16 days'),
  ('33333333-0000-0000-0000-000000000072', 'RC-0072', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '15 days'),
  ('33333333-0000-0000-0000-000000000073', 'RC-0073', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '15 days'),
  ('33333333-0000-0000-0000-000000000074', 'RC-0074', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '14 days'),
  ('33333333-0000-0000-0000-000000000075', 'RC-0075', 'Whitmore Antiques', 'pickup', 'normal',
   '11111111-1111-1111-1111-111111111114', '22222222-0000-0000-0000-000000000005',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '14 days'),

-- ── Unpacking (3 racks) ───────────────────────────────────────────────────────

  ('33333333-0000-0000-0000-000000000076', 'RC-0076', 'Crown Walk-in', 'unpacking', 'normal',
   '11111111-1111-1111-1111-111111111109', '22222222-0000-0000-0000-000000000007',
   NOW() - INTERVAL '2 hours 5 minutes', NOW() - INTERVAL '2 hours'),

  -- RC-0077: Hargrove rack still unpacking — BLOCKS RC-0045 and RC-0046 in sorting
  ('33333333-0000-0000-0000-000000000077', 'RC-0077', 'Hargrove Estate', 'unpacking', 'high',
   '11111111-1111-1111-1111-111111111109', '22222222-0000-0000-0000-000000000004',
   NOW() - INTERVAL '3 hours 10 minutes', NOW() - INTERVAL '3 hours'),

  ('33333333-0000-0000-0000-000000000078', 'RC-0078', 'Sterling Collections', 'unpacking', 'normal',
   '11111111-1111-1111-1111-111111111109', '22222222-0000-0000-0000-000000000010',
   NOW() - INTERVAL '2 hours 40 minutes', NOW() - INTERVAL '2 hours 30 minutes'),

-- ── Intake (2 racks) ──────────────────────────────────────────────────────────

  ('33333333-0000-0000-0000-000000000079', 'RC-0079', 'Sterling Collections', 'intake', 'normal',
   '11111111-1111-1111-1111-111111111107', '22222222-0000-0000-0000-000000000010',
   NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),

  ('33333333-0000-0000-0000-000000000080', 'RC-0080', 'Sterling Collections', 'intake', 'normal',
   '11111111-1111-1111-1111-111111111107', '22222222-0000-0000-0000-000000000010',
   NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),

-- ── Completed (3 racks) ───────────────────────────────────────────────────────

  ('33333333-0000-0000-0000-000000000081', 'RC-0081', 'Blackwood Furniture', 'completed', 'normal',
   NULL, '22222222-0000-0000-0000-000000000008',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),
  ('33333333-0000-0000-0000-000000000082', 'RC-0082', 'Blackwood Furniture', 'completed', 'normal',
   NULL, '22222222-0000-0000-0000-000000000008',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days'),
  ('33333333-0000-0000-0000-000000000083', 'RC-0083', 'Blackwood Furniture', 'completed', 'normal',
   NULL, '22222222-0000-0000-0000-000000000008',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '10 days')

ON CONFLICT (id) DO NOTHING;


-- ── Rack events ───────────────────────────────────────────────────────────────

INSERT INTO rack_events (id, rack_id, from_status, to_status, created_at) VALUES

-- ── Sorting racks (2 events each) ────────────────────────────────────────────

  -- RC-0043 Fernwood CRITICAL (9d): intake→unpacking→sorting
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000043', 'intake',    'unpacking', NOW() - INTERVAL '10 days'),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000043', 'unpacking', 'sorting',   NOW() - INTERVAL '9 days'),

  -- RC-0044 Pemberton CRITICAL (8d)
  ('44444444-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000044', 'intake',    'unpacking', NOW() - INTERVAL '8 days 20 hours'),
  ('44444444-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000044', 'unpacking', 'sorting',   NOW() - INTERVAL '8 days'),

  -- RC-0045 Hargrove BLOCKED (6d)
  ('44444444-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000045', 'intake',    'unpacking', NOW() - INTERVAL '7 days 18 hours'),
  ('44444444-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000045', 'unpacking', 'sorting',   NOW() - INTERVAL '6 days'),

  -- RC-0046 Hargrove BLOCKED (5d 6h)
  ('44444444-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000046', 'intake',    'unpacking', NOW() - INTERVAL '6 days 20 hours'),
  ('44444444-0000-0000-0000-000000000008', '33333333-0000-0000-0000-000000000046', 'unpacking', 'sorting',   NOW() - INTERVAL '5 days 6 hours'),

  -- RC-0047 Fernwood WARNING (6d)
  ('44444444-0000-0000-0000-000000000009', '33333333-0000-0000-0000-000000000047', 'intake',    'unpacking', NOW() - INTERVAL '7 days 12 hours'),
  ('44444444-0000-0000-0000-000000000010', '33333333-0000-0000-0000-000000000047', 'unpacking', 'sorting',   NOW() - INTERVAL '6 days'),

  -- RC-0048 Pemberton WARNING (5d 5h)
  ('44444444-0000-0000-0000-000000000011', '33333333-0000-0000-0000-000000000048', 'intake',    'unpacking', NOW() - INTERVAL '6 days 18 hours'),
  ('44444444-0000-0000-0000-000000000012', '33333333-0000-0000-0000-000000000048', 'unpacking', 'sorting',   NOW() - INTERVAL '5 days 5 hours'),

  -- RC-0049 Pemberton HEALTHY (2d)
  ('44444444-0000-0000-0000-000000000013', '33333333-0000-0000-0000-000000000049', 'intake',    'unpacking', NOW() - INTERVAL '4 days 18 hours'),
  ('44444444-0000-0000-0000-000000000014', '33333333-0000-0000-0000-000000000049', 'unpacking', 'sorting',   NOW() - INTERVAL '2 days'),

-- ── Lotting racks (3 events each) ────────────────────────────────────────────

  -- RC-0050 Crown (3.5h in lotting)
  ('44444444-0000-0000-0000-000000000015', '33333333-0000-0000-0000-000000000050', 'intake',    'unpacking', NOW() - INTERVAL '1 day 20 hours'),
  ('44444444-0000-0000-0000-000000000016', '33333333-0000-0000-0000-000000000050', 'unpacking', 'sorting',   NOW() - INTERVAL '8 hours'),
  ('44444444-0000-0000-0000-000000000017', '33333333-0000-0000-0000-000000000050', 'sorting',   'lotting',   NOW() - INTERVAL '3 hours 30 minutes'),

  -- RC-0051 Crown (2h in lotting)
  ('44444444-0000-0000-0000-000000000018', '33333333-0000-0000-0000-000000000051', 'intake',    'unpacking', NOW() - INTERVAL '1 day 20 hours'),
  ('44444444-0000-0000-0000-000000000019', '33333333-0000-0000-0000-000000000051', 'unpacking', 'sorting',   NOW() - INTERVAL '6 hours'),
  ('44444444-0000-0000-0000-000000000020', '33333333-0000-0000-0000-000000000051', 'sorting',   'lotting',   NOW() - INTERVAL '2 hours'),

  -- RC-0052 Hargrove (cleared sorting after 7d 21h delay)
  ('44444444-0000-0000-0000-000000000021', '33333333-0000-0000-0000-000000000052', 'intake',    'unpacking', NOW() - INTERVAL '9 days 18 hours'),
  ('44444444-0000-0000-0000-000000000022', '33333333-0000-0000-0000-000000000052', 'unpacking', 'sorting',   NOW() - INTERVAL '8 days'),
  ('44444444-0000-0000-0000-000000000023', '33333333-0000-0000-0000-000000000052', 'sorting',   'lotting',   NOW() - INTERVAL '3 hours'),

  -- RC-0053 Fernwood (cleared sorting after 6d 20h)
  ('44444444-0000-0000-0000-000000000024', '33333333-0000-0000-0000-000000000053', 'intake',    'unpacking', NOW() - INTERVAL '8 days 18 hours'),
  ('44444444-0000-0000-0000-000000000025', '33333333-0000-0000-0000-000000000053', 'unpacking', 'sorting',   NOW() - INTERVAL '7 days'),
  ('44444444-0000-0000-0000-000000000026', '33333333-0000-0000-0000-000000000053', 'sorting',   'lotting',   NOW() - INTERVAL '4 hours'),

  -- RC-0054 Crown (1.5h in lotting)
  ('44444444-0000-0000-0000-000000000027', '33333333-0000-0000-0000-000000000054', 'intake',    'unpacking', NOW() - INTERVAL '1 day 20 hours'),
  ('44444444-0000-0000-0000-000000000028', '33333333-0000-0000-0000-000000000054', 'unpacking', 'sorting',   NOW() - INTERVAL '7 hours'),
  ('44444444-0000-0000-0000-000000000029', '33333333-0000-0000-0000-000000000054', 'sorting',   'lotting',   NOW() - INTERVAL '1 hour 30 minutes'),

-- ── Ready racks (4 events each) ──────────────────────────────────────────────

  -- RC-0055 Hargrove ready 7d
  ('44444444-0000-0000-0000-000000000030', '33333333-0000-0000-0000-000000000055', 'intake',    'unpacking', NOW() - INTERVAL '10 days 18 hours'),
  ('44444444-0000-0000-0000-000000000031', '33333333-0000-0000-0000-000000000055', 'unpacking', 'sorting',   NOW() - INTERVAL '9 days'),
  ('44444444-0000-0000-0000-000000000032', '33333333-0000-0000-0000-000000000055', 'sorting',   'lotting',   NOW() - INTERVAL '7 days 12 hours'),
  ('44444444-0000-0000-0000-000000000033', '33333333-0000-0000-0000-000000000055', 'lotting',   'ready',     NOW() - INTERVAL '7 days'),

  -- RC-0056 Hargrove ready 6d
  ('44444444-0000-0000-0000-000000000034', '33333333-0000-0000-0000-000000000056', 'intake',    'unpacking', NOW() - INTERVAL '9 days 18 hours'),
  ('44444444-0000-0000-0000-000000000035', '33333333-0000-0000-0000-000000000056', 'unpacking', 'sorting',   NOW() - INTERVAL '8 days'),
  ('44444444-0000-0000-0000-000000000036', '33333333-0000-0000-0000-000000000056', 'sorting',   'lotting',   NOW() - INTERVAL '6 days 12 hours'),
  ('44444444-0000-0000-0000-000000000037', '33333333-0000-0000-0000-000000000056', 'lotting',   'ready',     NOW() - INTERVAL '6 days'),

  -- RC-0057 Hargrove ready 8d
  ('44444444-0000-0000-0000-000000000038', '33333333-0000-0000-0000-000000000057', 'intake',    'unpacking', NOW() - INTERVAL '11 days 18 hours'),
  ('44444444-0000-0000-0000-000000000039', '33333333-0000-0000-0000-000000000057', 'unpacking', 'sorting',   NOW() - INTERVAL '10 days'),
  ('44444444-0000-0000-0000-000000000040', '33333333-0000-0000-0000-000000000057', 'sorting',   'lotting',   NOW() - INTERVAL '8 days 16 hours'),
  ('44444444-0000-0000-0000-000000000041', '33333333-0000-0000-0000-000000000057', 'lotting',   'ready',     NOW() - INTERVAL '8 days'),

  -- RC-0058 Whitmore ready 5d (was in sorting ~20d — backlog resolved)
  ('44444444-0000-0000-0000-000000000042', '33333333-0000-0000-0000-000000000058', 'intake',    'unpacking', NOW() - INTERVAL '27 days 18 hours'),
  ('44444444-0000-0000-0000-000000000043', '33333333-0000-0000-0000-000000000058', 'unpacking', 'sorting',   NOW() - INTERVAL '26 days'),
  ('44444444-0000-0000-0000-000000000044', '33333333-0000-0000-0000-000000000058', 'sorting',   'lotting',   NOW() - INTERVAL '5 days 8 hours'),
  ('44444444-0000-0000-0000-000000000045', '33333333-0000-0000-0000-000000000058', 'lotting',   'ready',     NOW() - INTERVAL '5 days'),

  -- RC-0059 Whitmore ready 6d
  ('44444444-0000-0000-0000-000000000046', '33333333-0000-0000-0000-000000000059', 'intake',    'unpacking', NOW() - INTERVAL '27 days 12 hours'),
  ('44444444-0000-0000-0000-000000000047', '33333333-0000-0000-0000-000000000059', 'unpacking', 'sorting',   NOW() - INTERVAL '25 days'),
  ('44444444-0000-0000-0000-000000000048', '33333333-0000-0000-0000-000000000059', 'sorting',   'lotting',   NOW() - INTERVAL '6 days 8 hours'),
  ('44444444-0000-0000-0000-000000000049', '33333333-0000-0000-0000-000000000059', 'lotting',   'ready',     NOW() - INTERVAL '6 days'),

-- ── Pickup racks — Whitmore batch (5 events each, 16 racks) ──────────────────

  -- RC-0060 (pickup 21d ago)
  ('44444444-0000-0000-0000-000000000050', '33333333-0000-0000-0000-000000000060', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000051', '33333333-0000-0000-0000-000000000060', 'unpacking', 'sorting',   NOW() - INTERVAL '25 days'),
  ('44444444-0000-0000-0000-000000000052', '33333333-0000-0000-0000-000000000060', 'sorting',   'lotting',   NOW() - INTERVAL '21 days 8 hours'),
  ('44444444-0000-0000-0000-000000000053', '33333333-0000-0000-0000-000000000060', 'lotting',   'ready',     NOW() - INTERVAL '21 days 4 hours'),
  ('44444444-0000-0000-0000-000000000054', '33333333-0000-0000-0000-000000000060', 'ready',     'pickup',    NOW() - INTERVAL '21 days'),

  -- RC-0061 (pickup 21d ago)
  ('44444444-0000-0000-0000-000000000055', '33333333-0000-0000-0000-000000000061', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000056', '33333333-0000-0000-0000-000000000061', 'unpacking', 'sorting',   NOW() - INTERVAL '25 days'),
  ('44444444-0000-0000-0000-000000000057', '33333333-0000-0000-0000-000000000061', 'sorting',   'lotting',   NOW() - INTERVAL '21 days 10 hours'),
  ('44444444-0000-0000-0000-000000000058', '33333333-0000-0000-0000-000000000061', 'lotting',   'ready',     NOW() - INTERVAL '21 days 6 hours'),
  ('44444444-0000-0000-0000-000000000059', '33333333-0000-0000-0000-000000000061', 'ready',     'pickup',    NOW() - INTERVAL '21 days'),

  -- RC-0062 (pickup 20d ago)
  ('44444444-0000-0000-0000-000000000060', '33333333-0000-0000-0000-000000000062', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000061', '33333333-0000-0000-0000-000000000062', 'unpacking', 'sorting',   NOW() - INTERVAL '24 days 12 hours'),
  ('44444444-0000-0000-0000-000000000062', '33333333-0000-0000-0000-000000000062', 'sorting',   'lotting',   NOW() - INTERVAL '20 days 8 hours'),
  ('44444444-0000-0000-0000-000000000063', '33333333-0000-0000-0000-000000000062', 'lotting',   'ready',     NOW() - INTERVAL '20 days 4 hours'),
  ('44444444-0000-0000-0000-000000000064', '33333333-0000-0000-0000-000000000062', 'ready',     'pickup',    NOW() - INTERVAL '20 days'),

  -- RC-0063 (pickup 20d ago)
  ('44444444-0000-0000-0000-000000000065', '33333333-0000-0000-0000-000000000063', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000066', '33333333-0000-0000-0000-000000000063', 'unpacking', 'sorting',   NOW() - INTERVAL '24 days'),
  ('44444444-0000-0000-0000-000000000067', '33333333-0000-0000-0000-000000000063', 'sorting',   'lotting',   NOW() - INTERVAL '20 days 10 hours'),
  ('44444444-0000-0000-0000-000000000068', '33333333-0000-0000-0000-000000000063', 'lotting',   'ready',     NOW() - INTERVAL '20 days 6 hours'),
  ('44444444-0000-0000-0000-000000000069', '33333333-0000-0000-0000-000000000063', 'ready',     'pickup',    NOW() - INTERVAL '20 days'),

  -- RC-0064 (pickup 19d ago)
  ('44444444-0000-0000-0000-000000000070', '33333333-0000-0000-0000-000000000064', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000071', '33333333-0000-0000-0000-000000000064', 'unpacking', 'sorting',   NOW() - INTERVAL '23 days 12 hours'),
  ('44444444-0000-0000-0000-000000000072', '33333333-0000-0000-0000-000000000064', 'sorting',   'lotting',   NOW() - INTERVAL '19 days 8 hours'),
  ('44444444-0000-0000-0000-000000000073', '33333333-0000-0000-0000-000000000064', 'lotting',   'ready',     NOW() - INTERVAL '19 days 4 hours'),
  ('44444444-0000-0000-0000-000000000074', '33333333-0000-0000-0000-000000000064', 'ready',     'pickup',    NOW() - INTERVAL '19 days'),

  -- RC-0065 (pickup 19d ago)
  ('44444444-0000-0000-0000-000000000075', '33333333-0000-0000-0000-000000000065', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000076', '33333333-0000-0000-0000-000000000065', 'unpacking', 'sorting',   NOW() - INTERVAL '23 days'),
  ('44444444-0000-0000-0000-000000000077', '33333333-0000-0000-0000-000000000065', 'sorting',   'lotting',   NOW() - INTERVAL '19 days 10 hours'),
  ('44444444-0000-0000-0000-000000000078', '33333333-0000-0000-0000-000000000065', 'lotting',   'ready',     NOW() - INTERVAL '19 days 6 hours'),
  ('44444444-0000-0000-0000-000000000079', '33333333-0000-0000-0000-000000000065', 'ready',     'pickup',    NOW() - INTERVAL '19 days'),

  -- RC-0066 (pickup 18d ago)
  ('44444444-0000-0000-0000-000000000080', '33333333-0000-0000-0000-000000000066', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000081', '33333333-0000-0000-0000-000000000066', 'unpacking', 'sorting',   NOW() - INTERVAL '22 days 12 hours'),
  ('44444444-0000-0000-0000-000000000082', '33333333-0000-0000-0000-000000000066', 'sorting',   'lotting',   NOW() - INTERVAL '18 days 8 hours'),
  ('44444444-0000-0000-0000-000000000083', '33333333-0000-0000-0000-000000000066', 'lotting',   'ready',     NOW() - INTERVAL '18 days 4 hours'),
  ('44444444-0000-0000-0000-000000000084', '33333333-0000-0000-0000-000000000066', 'ready',     'pickup',    NOW() - INTERVAL '18 days'),

  -- RC-0067 (pickup 18d ago)
  ('44444444-0000-0000-0000-000000000085', '33333333-0000-0000-0000-000000000067', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000086', '33333333-0000-0000-0000-000000000067', 'unpacking', 'sorting',   NOW() - INTERVAL '22 days'),
  ('44444444-0000-0000-0000-000000000087', '33333333-0000-0000-0000-000000000067', 'sorting',   'lotting',   NOW() - INTERVAL '18 days 10 hours'),
  ('44444444-0000-0000-0000-000000000088', '33333333-0000-0000-0000-000000000067', 'lotting',   'ready',     NOW() - INTERVAL '18 days 6 hours'),
  ('44444444-0000-0000-0000-000000000089', '33333333-0000-0000-0000-000000000067', 'ready',     'pickup',    NOW() - INTERVAL '18 days'),

  -- RC-0068 (pickup 17d ago)
  ('44444444-0000-0000-0000-000000000090', '33333333-0000-0000-0000-000000000068', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000091', '33333333-0000-0000-0000-000000000068', 'unpacking', 'sorting',   NOW() - INTERVAL '21 days 12 hours'),
  ('44444444-0000-0000-0000-000000000092', '33333333-0000-0000-0000-000000000068', 'sorting',   'lotting',   NOW() - INTERVAL '17 days 8 hours'),
  ('44444444-0000-0000-0000-000000000093', '33333333-0000-0000-0000-000000000068', 'lotting',   'ready',     NOW() - INTERVAL '17 days 4 hours'),
  ('44444444-0000-0000-0000-000000000094', '33333333-0000-0000-0000-000000000068', 'ready',     'pickup',    NOW() - INTERVAL '17 days'),

  -- RC-0069 (pickup 17d ago)
  ('44444444-0000-0000-0000-000000000095', '33333333-0000-0000-0000-000000000069', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000096', '33333333-0000-0000-0000-000000000069', 'unpacking', 'sorting',   NOW() - INTERVAL '21 days'),
  ('44444444-0000-0000-0000-000000000097', '33333333-0000-0000-0000-000000000069', 'sorting',   'lotting',   NOW() - INTERVAL '17 days 10 hours'),
  ('44444444-0000-0000-0000-000000000098', '33333333-0000-0000-0000-000000000069', 'lotting',   'ready',     NOW() - INTERVAL '17 days 6 hours'),
  ('44444444-0000-0000-0000-000000000099', '33333333-0000-0000-0000-000000000069', 'ready',     'pickup',    NOW() - INTERVAL '17 days'),

  -- RC-0070 (pickup 16d ago)
  ('44444444-0000-0000-0000-000000000100', '33333333-0000-0000-0000-000000000070', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000101', '33333333-0000-0000-0000-000000000070', 'unpacking', 'sorting',   NOW() - INTERVAL '20 days 12 hours'),
  ('44444444-0000-0000-0000-000000000102', '33333333-0000-0000-0000-000000000070', 'sorting',   'lotting',   NOW() - INTERVAL '16 days 8 hours'),
  ('44444444-0000-0000-0000-000000000103', '33333333-0000-0000-0000-000000000070', 'lotting',   'ready',     NOW() - INTERVAL '16 days 4 hours'),
  ('44444444-0000-0000-0000-000000000104', '33333333-0000-0000-0000-000000000070', 'ready',     'pickup',    NOW() - INTERVAL '16 days'),

  -- RC-0071 (pickup 16d ago)
  ('44444444-0000-0000-0000-000000000105', '33333333-0000-0000-0000-000000000071', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000106', '33333333-0000-0000-0000-000000000071', 'unpacking', 'sorting',   NOW() - INTERVAL '20 days'),
  ('44444444-0000-0000-0000-000000000107', '33333333-0000-0000-0000-000000000071', 'sorting',   'lotting',   NOW() - INTERVAL '16 days 10 hours'),
  ('44444444-0000-0000-0000-000000000108', '33333333-0000-0000-0000-000000000071', 'lotting',   'ready',     NOW() - INTERVAL '16 days 6 hours'),
  ('44444444-0000-0000-0000-000000000109', '33333333-0000-0000-0000-000000000071', 'ready',     'pickup',    NOW() - INTERVAL '16 days'),

  -- RC-0072 (pickup 15d ago)
  ('44444444-0000-0000-0000-000000000110', '33333333-0000-0000-0000-000000000072', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000111', '33333333-0000-0000-0000-000000000072', 'unpacking', 'sorting',   NOW() - INTERVAL '19 days 12 hours'),
  ('44444444-0000-0000-0000-000000000112', '33333333-0000-0000-0000-000000000072', 'sorting',   'lotting',   NOW() - INTERVAL '15 days 8 hours'),
  ('44444444-0000-0000-0000-000000000113', '33333333-0000-0000-0000-000000000072', 'lotting',   'ready',     NOW() - INTERVAL '15 days 4 hours'),
  ('44444444-0000-0000-0000-000000000114', '33333333-0000-0000-0000-000000000072', 'ready',     'pickup',    NOW() - INTERVAL '15 days'),

  -- RC-0073 (pickup 15d ago)
  ('44444444-0000-0000-0000-000000000115', '33333333-0000-0000-0000-000000000073', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000116', '33333333-0000-0000-0000-000000000073', 'unpacking', 'sorting',   NOW() - INTERVAL '19 days'),
  ('44444444-0000-0000-0000-000000000117', '33333333-0000-0000-0000-000000000073', 'sorting',   'lotting',   NOW() - INTERVAL '15 days 10 hours'),
  ('44444444-0000-0000-0000-000000000118', '33333333-0000-0000-0000-000000000073', 'lotting',   'ready',     NOW() - INTERVAL '15 days 6 hours'),
  ('44444444-0000-0000-0000-000000000119', '33333333-0000-0000-0000-000000000073', 'ready',     'pickup',    NOW() - INTERVAL '15 days'),

  -- RC-0074 (pickup 14d ago)
  ('44444444-0000-0000-0000-000000000120', '33333333-0000-0000-0000-000000000074', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000121', '33333333-0000-0000-0000-000000000074', 'unpacking', 'sorting',   NOW() - INTERVAL '18 days 12 hours'),
  ('44444444-0000-0000-0000-000000000122', '33333333-0000-0000-0000-000000000074', 'sorting',   'lotting',   NOW() - INTERVAL '14 days 8 hours'),
  ('44444444-0000-0000-0000-000000000123', '33333333-0000-0000-0000-000000000074', 'lotting',   'ready',     NOW() - INTERVAL '14 days 4 hours'),
  ('44444444-0000-0000-0000-000000000124', '33333333-0000-0000-0000-000000000074', 'ready',     'pickup',    NOW() - INTERVAL '14 days'),

  -- RC-0075 (pickup 14d ago)
  ('44444444-0000-0000-0000-000000000125', '33333333-0000-0000-0000-000000000075', 'intake',    'unpacking', NOW() - INTERVAL '27 days'),
  ('44444444-0000-0000-0000-000000000126', '33333333-0000-0000-0000-000000000075', 'unpacking', 'sorting',   NOW() - INTERVAL '18 days'),
  ('44444444-0000-0000-0000-000000000127', '33333333-0000-0000-0000-000000000075', 'sorting',   'lotting',   NOW() - INTERVAL '14 days 10 hours'),
  ('44444444-0000-0000-0000-000000000128', '33333333-0000-0000-0000-000000000075', 'lotting',   'ready',     NOW() - INTERVAL '14 days 6 hours'),
  ('44444444-0000-0000-0000-000000000129', '33333333-0000-0000-0000-000000000075', 'ready',     'pickup',    NOW() - INTERVAL '14 days'),

-- ── Unpacking racks (1 event each) ───────────────────────────────────────────

  ('44444444-0000-0000-0000-000000000130', '33333333-0000-0000-0000-000000000076', 'intake', 'unpacking', NOW() - INTERVAL '2 hours'),
  ('44444444-0000-0000-0000-000000000131', '33333333-0000-0000-0000-000000000077', 'intake', 'unpacking', NOW() - INTERVAL '3 hours'),
  ('44444444-0000-0000-0000-000000000132', '33333333-0000-0000-0000-000000000078', 'intake', 'unpacking', NOW() - INTERVAL '2 hours 30 minutes'),

-- ── Completed racks — Blackwood (6 events each) ───────────────────────────────

  -- RC-0081
  ('44444444-0000-0000-0000-000000000133', '33333333-0000-0000-0000-000000000081', 'intake',    'unpacking', NOW() - INTERVAL '13 days 20 hours'),
  ('44444444-0000-0000-0000-000000000134', '33333333-0000-0000-0000-000000000081', 'unpacking', 'sorting',   NOW() - INTERVAL '13 days 12 hours'),
  ('44444444-0000-0000-0000-000000000135', '33333333-0000-0000-0000-000000000081', 'sorting',   'lotting',   NOW() - INTERVAL '11 days'),
  ('44444444-0000-0000-0000-000000000136', '33333333-0000-0000-0000-000000000081', 'lotting',   'ready',     NOW() - INTERVAL '10 days 20 hours'),
  ('44444444-0000-0000-0000-000000000137', '33333333-0000-0000-0000-000000000081', 'ready',     'pickup',    NOW() - INTERVAL '10 days 18 hours'),
  ('44444444-0000-0000-0000-000000000138', '33333333-0000-0000-0000-000000000081', 'pickup',    'completed', NOW() - INTERVAL '10 days'),

  -- RC-0082
  ('44444444-0000-0000-0000-000000000139', '33333333-0000-0000-0000-000000000082', 'intake',    'unpacking', NOW() - INTERVAL '13 days 18 hours'),
  ('44444444-0000-0000-0000-000000000140', '33333333-0000-0000-0000-000000000082', 'unpacking', 'sorting',   NOW() - INTERVAL '13 days 10 hours'),
  ('44444444-0000-0000-0000-000000000141', '33333333-0000-0000-0000-000000000082', 'sorting',   'lotting',   NOW() - INTERVAL '10 days 22 hours'),
  ('44444444-0000-0000-0000-000000000142', '33333333-0000-0000-0000-000000000082', 'lotting',   'ready',     NOW() - INTERVAL '10 days 18 hours'),
  ('44444444-0000-0000-0000-000000000143', '33333333-0000-0000-0000-000000000082', 'ready',     'pickup',    NOW() - INTERVAL '10 days 16 hours'),
  ('44444444-0000-0000-0000-000000000144', '33333333-0000-0000-0000-000000000082', 'pickup',    'completed', NOW() - INTERVAL '10 days'),

  -- RC-0083
  ('44444444-0000-0000-0000-000000000145', '33333333-0000-0000-0000-000000000083', 'intake',    'unpacking', NOW() - INTERVAL '13 days 22 hours'),
  ('44444444-0000-0000-0000-000000000146', '33333333-0000-0000-0000-000000000083', 'unpacking', 'sorting',   NOW() - INTERVAL '13 days 14 hours'),
  ('44444444-0000-0000-0000-000000000147', '33333333-0000-0000-0000-000000000083', 'sorting',   'lotting',   NOW() - INTERVAL '11 days 2 hours'),
  ('44444444-0000-0000-0000-000000000148', '33333333-0000-0000-0000-000000000083', 'lotting',   'ready',     NOW() - INTERVAL '10 days 22 hours'),
  ('44444444-0000-0000-0000-000000000149', '33333333-0000-0000-0000-000000000083', 'ready',     'pickup',    NOW() - INTERVAL '10 days 20 hours'),
  ('44444444-0000-0000-0000-000000000150', '33333333-0000-0000-0000-000000000083', 'pickup',    'completed', NOW() - INTERVAL '10 days')

ON CONFLICT (id) DO NOTHING;


-- ── Advance sequences ─────────────────────────────────────────────────────────
SELECT setval('delivery_code_seq', 11, true);  -- next: DEL-0012
SELECT setval('rack_code_seq',     83, true);  -- next: RC-0084
