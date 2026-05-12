-- Migration: Donation and trash outcome percentages on deliveries
-- Track what percentage of a delivery was donated vs. trashed (dumpster charge)

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS donation_percent integer CHECK (donation_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS trash_percent    integer CHECK (trash_percent    BETWEEN 0 AND 100);
