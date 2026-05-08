-- Migration: delivery zone assignment
-- Run in Supabase SQL editor

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;
