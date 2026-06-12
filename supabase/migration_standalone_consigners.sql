-- Allow rack_consigners to represent standalone consigners with no rack yet.
-- Run in Supabase SQL editor.

ALTER TABLE rack_consigners ALTER COLUMN rack_id DROP NOT NULL;
