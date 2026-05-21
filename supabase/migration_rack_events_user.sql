-- Track who performed each rack status transition
ALTER TABLE rack_events ADD COLUMN IF NOT EXISTS performed_by TEXT;

-- Re-create advance_rack_status to capture the authenticated user's email
CREATE OR REPLACE FUNCTION advance_rack_status(
  p_rack_id   uuid,
  p_to_status text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_from_status text;
BEGIN
  SELECT status INTO v_from_status
  FROM racks
  WHERE id = p_rack_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rack % not found', p_rack_id;
  END IF;

  IF v_from_status = 'completed' THEN
    RAISE EXCEPTION 'Rack % is already completed', p_rack_id;
  END IF;

  UPDATE racks
  SET status = p_to_status
  WHERE id = p_rack_id;

  INSERT INTO rack_events (rack_id, from_status, to_status, performed_by)
  VALUES (p_rack_id, v_from_status, p_to_status, auth.jwt() ->> 'email');
END;
$$;
