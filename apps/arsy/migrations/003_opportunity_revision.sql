-- Add optimistic concurrency to editable opportunities without mutating an applied migration.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1
  CHECK (revision > 0);
