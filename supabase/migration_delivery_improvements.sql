-- Migration: Delivery workflow improvements
-- Adds 'unpacking_complete' status between processing and complete.
-- Also allows editing consigner name, J-number, and expected rack count.

-- 1. Drop the existing status check constraint and re-add with new value
ALTER TABLE deliveries
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_status_check
  CHECK (status IN ('scheduled', 'arrived', 'processing', 'unpacking_complete', 'complete'));
