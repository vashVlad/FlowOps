-- Run this in the Supabase SQL Editor to enable global auction color → date mappings.

CREATE TABLE IF NOT EXISTS auction_color_dates (
  color_hex    TEXT        PRIMARY KEY,
  auction_date DATE        NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE auction_color_dates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read; only admins write (RLS handled at app layer).
CREATE POLICY "Authenticated users can read auction color dates"
  ON auction_color_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage auction color dates"
  ON auction_color_dates FOR ALL TO authenticated USING (true) WITH CHECK (true);
