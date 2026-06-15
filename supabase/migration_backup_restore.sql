-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Backup & Restore support
--
-- Adds sync_code_sequences(), called after a JSON backup is restored via the
-- Reports page. Restored rows carry explicit rack_code/delivery_code values
-- (e.g. RC-0087, DEL-0042) — this bumps the rack_code_seq / delivery_code_seq
-- counters past the highest restored number so the next *new* rack/delivery
-- created after a restore doesn't collide with a restored code.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_code_sequences()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_max_rack     integer;
  v_max_delivery integer;
BEGIN
  SELECT COALESCE(MAX(substring(rack_code FROM 'RC-(\d+)')::integer), 0)
    INTO v_max_rack
    FROM racks;

  SELECT COALESCE(MAX(substring(delivery_code FROM 'DEL-(\d+)')::integer), 0)
    INTO v_max_delivery
    FROM deliveries;

  PERFORM setval('rack_code_seq', GREATEST(v_max_rack, 0) + 1, false);
  PERFORM setval('delivery_code_seq', GREATEST(v_max_delivery, 0) + 1, false);
END;
$$;

COMMENT ON FUNCTION sync_code_sequences IS
  'Bumps rack_code_seq/delivery_code_seq past the highest existing code. Run after restoring a backup.';
