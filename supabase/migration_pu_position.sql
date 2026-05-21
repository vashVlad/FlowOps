-- Add pu_position column to racks for PU floor plan slot assignments
ALTER TABLE racks ADD COLUMN IF NOT EXISTS pu_position TEXT;
