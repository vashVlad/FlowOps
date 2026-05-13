-- Migration: Flip zone-delivery relationship
-- Moves the foreign key from deliveries.zone_id → zones.delivery_id
-- so multiple zones can be assigned to one delivery.

-- 1. Add delivery_id to zones
ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zones_delivery_id ON zones (delivery_id);

-- 2. Migrate existing assignments
UPDATE zones z
SET delivery_id = (
  SELECT d.id FROM deliveries d WHERE d.zone_id = z.id LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM deliveries d WHERE d.zone_id = z.id
);

-- 3. Drop old FK column from deliveries
ALTER TABLE deliveries DROP COLUMN IF EXISTS zone_id;
