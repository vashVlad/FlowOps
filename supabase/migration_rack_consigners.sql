-- Migration: Mixed-consigner racks
-- Each rack can have additional consigners beyond its primary delivery consigner.

CREATE TABLE IF NOT EXISTS rack_consigners (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id        uuid NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  consigner_name text NOT NULL CHECK (char_length(trim(consigner_name)) > 0),
  j_number       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rack_consigners_rack_id_idx ON rack_consigners (rack_id);

-- Enable Row Level Security (mirror racks table policy)
ALTER TABLE rack_consigners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rack_consigners_all" ON rack_consigners
  FOR ALL USING (true) WITH CHECK (true);
