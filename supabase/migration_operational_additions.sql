-- Migration: Operational Realism Additions
-- Phase 3 — Hold State · Auction Date · Rack Notes · Delivery Photos
-- Run in Supabase SQL editor (safe to re-run: IF NOT EXISTS guards on tables/indexes)

-- ── 1. HOLD STATE ─────────────────────────────────────────────────────────────
ALTER TABLE racks
  ADD COLUMN IF NOT EXISTS hold_reason      text,
  ADD COLUMN IF NOT EXISTS hold_started_at  timestamptz;

-- ── 2. AUCTION DATE ───────────────────────────────────────────────────────────
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS auction_date date;

-- ── 3. RACK NOTES (operational activity pins) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS rack_notes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id      uuid        REFERENCES racks(id)      ON DELETE CASCADE,
  delivery_id  uuid        REFERENCES deliveries(id) ON DELETE CASCADE,
  note         text        NOT NULL CHECK (char_length(trim(note)) > 0),
  pinned       boolean     NOT NULL DEFAULT true,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rack_or_delivery_xor CHECK (
    (rack_id IS NOT NULL) <> (delivery_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rack_notes_rack     ON rack_notes(rack_id)     WHERE rack_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rack_notes_delivery ON rack_notes(delivery_id) WHERE delivery_id IS NOT NULL;

ALTER TABLE rack_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_rack_notes" ON rack_notes;
DROP POLICY IF EXISTS "auth_insert_rack_notes" ON rack_notes;
DROP POLICY IF EXISTS "auth_delete_rack_notes" ON rack_notes;
CREATE POLICY "auth_select_rack_notes" ON rack_notes FOR SELECT USING      (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_rack_notes" ON rack_notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_rack_notes" ON rack_notes FOR DELETE USING      (auth.role() = 'authenticated');

-- ── 4. DELIVERY PHOTOS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_photos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  uuid        NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  storage_path text        NOT NULL,
  caption      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_photos_delivery ON delivery_photos(delivery_id);

ALTER TABLE delivery_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_delivery_photos" ON delivery_photos;
DROP POLICY IF EXISTS "auth_insert_delivery_photos" ON delivery_photos;
DROP POLICY IF EXISTS "auth_delete_delivery_photos" ON delivery_photos;
CREATE POLICY "auth_select_delivery_photos" ON delivery_photos FOR SELECT USING      (auth.role() = 'authenticated');
CREATE POLICY "auth_insert_delivery_photos" ON delivery_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_delete_delivery_photos" ON delivery_photos FOR DELETE USING      (auth.role() = 'authenticated');

/*
  SUPABASE STORAGE SETUP — run these separately after creating the bucket.
  ─────────────────────────────────────────────────────────────────────────────
  1. In Supabase dashboard → Storage → New Bucket:
       Name:   delivery-photos
       Public: OFF  (private — access via signed URLs, 1h expiry)

  2. Storage RLS policies — paste into SQL editor:

  CREATE POLICY "auth_upload_delivery_photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');

  CREATE POLICY "auth_read_delivery_photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');

  CREATE POLICY "auth_delete_delivery_photos"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');
*/
