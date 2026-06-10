-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Dumpster fill tracking for billing
--
-- Two physical dumpsters (Gallery, Warehouse). Each "add" entry logs how much
-- of a delivery's items were trashed, expressed as a % of dumpster capacity.
-- That same percent becomes the delivery's trash_percent (read-only on the
-- delivery page — no longer editable there). A "swap" entry archives the
-- final fill level and resets the dumpster to 0% with a fresh arrival date.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dumpsters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  fill_percent integer NOT NULL DEFAULT 0 CHECK (fill_percent BETWEEN 0 AND 100),
  arrived_at   date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO dumpsters (name) VALUES ('Gallery'), ('Warehouse')
ON CONFLICT (name) DO NOTHING;

DROP TRIGGER IF EXISTS dumpsters_set_updated_at ON dumpsters;
CREATE TRIGGER dumpsters_set_updated_at
  BEFORE UPDATE ON dumpsters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS dumpster_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dumpster_id uuid NOT NULL REFERENCES dumpsters(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('add', 'swap')),
  percent     integer NOT NULL CHECK (percent BETWEEN 0 AND 100),
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dumpster_entries_dumpster_id_idx ON dumpster_entries (dumpster_id);
CREATE INDEX IF NOT EXISTS dumpster_entries_delivery_id_idx ON dumpster_entries (delivery_id);
CREATE INDEX IF NOT EXISTS dumpster_entries_created_at_idx ON dumpster_entries (created_at DESC);

ALTER TABLE dumpsters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dumpster_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dumpsters_all"        ON dumpsters        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dumpster_entries_all" ON dumpster_entries FOR ALL USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: add_dumpster_entry(dumpster_id, delivery_id, percent)
-- Atomically: logs an 'add' entry, bumps the dumpster's fill level (capped at
-- 100), and stamps the delivery's trash_percent for read-only display.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_dumpster_entry(
  p_dumpster_id uuid,
  p_delivery_id uuid,
  p_percent     integer
)
RETURNS dumpster_entries LANGUAGE plpgsql AS $$
DECLARE
  v_entry dumpster_entries;
BEGIN
  IF p_percent < 0 OR p_percent > 100 THEN
    RAISE EXCEPTION 'Percent must be between 0 and 100';
  END IF;

  INSERT INTO dumpster_entries (dumpster_id, type, percent, delivery_id, created_by)
  VALUES (p_dumpster_id, 'add', p_percent, p_delivery_id, auth.jwt() ->> 'email')
  RETURNING * INTO v_entry;

  UPDATE dumpsters
  SET fill_percent = LEAST(100, fill_percent + p_percent)
  WHERE id = p_dumpster_id;

  UPDATE deliveries
  SET trash_percent = p_percent
  WHERE id = p_delivery_id;

  RETURN v_entry;
END;
$$;

COMMENT ON FUNCTION add_dumpster_entry IS
  'Logs a dumpster fill entry, bumps the dumpster level, and stamps the delivery''s trash_percent.';


-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: swap_dumpster(dumpster_id)
-- Atomically: logs a 'swap' entry recording the final fill level, then resets
-- the dumpster to 0% with today as the new arrival date.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION swap_dumpster(
  p_dumpster_id uuid
)
RETURNS dumpster_entries LANGUAGE plpgsql AS $$
DECLARE
  v_entry dumpster_entries;
  v_fill  integer;
BEGIN
  SELECT fill_percent INTO v_fill FROM dumpsters WHERE id = p_dumpster_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dumpster % not found', p_dumpster_id;
  END IF;

  INSERT INTO dumpster_entries (dumpster_id, type, percent, created_by)
  VALUES (p_dumpster_id, 'swap', v_fill, auth.jwt() ->> 'email')
  RETURNING * INTO v_entry;

  UPDATE dumpsters
  SET fill_percent = 0,
      arrived_at   = CURRENT_DATE
  WHERE id = p_dumpster_id;

  RETURN v_entry;
END;
$$;

COMMENT ON FUNCTION swap_dumpster IS
  'Archives the current fill level as a swap entry and resets the dumpster to 0% / today.';


-- ════════════════════════════════════════════════════════════════════════════
-- FUNCTION: delete_dumpster_entry(entry_id)
-- For 'add' entries: reverses the fill bump and clears the linked delivery's
-- trash_percent (if it still matches), then deletes the log row. 'swap'
-- entries are deleted as a plain log correction without restoring fill state.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_dumpster_entry(
  p_entry_id uuid
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_entry dumpster_entries;
BEGIN
  SELECT * INTO v_entry FROM dumpster_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry % not found', p_entry_id;
  END IF;

  IF v_entry.type = 'add' THEN
    UPDATE dumpsters
    SET fill_percent = GREATEST(0, fill_percent - v_entry.percent)
    WHERE id = v_entry.dumpster_id;

    IF v_entry.delivery_id IS NOT NULL THEN
      UPDATE deliveries
      SET trash_percent = NULL
      WHERE id = v_entry.delivery_id AND trash_percent = v_entry.percent;
    END IF;
  END IF;

  DELETE FROM dumpster_entries WHERE id = p_entry_id;
END;
$$;

COMMENT ON FUNCTION delete_dumpster_entry IS
  'Corrects a logged entry: reverses fill/trash_percent for adds, removes the row.';
