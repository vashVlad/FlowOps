-- Migration: consigner J-Number + rack edit support
-- Run in Supabase SQL editor

-- Add J-Number to deliveries (nullable, user-provided)
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS consigner_j_number text;

-- rack_code is already UNIQUE from the base schema.
-- No extra DDL needed for rack editing — UPDATE on racks is already supported.
\