-- The commerce repository uses this marker to atomically freeze an opportunity once a
-- ProductVersion snapshot is created. Keep this additive for existing installations.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS product_promoted_at timestamptz;

CREATE INDEX IF NOT EXISTS arsy_opportunities_promoted_idx
  ON arsy_opportunities (owner_id, product_promoted_at)
  WHERE product_promoted_at IS NOT NULL;
