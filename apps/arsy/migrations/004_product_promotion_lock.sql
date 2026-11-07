-- Freeze an opportunity when its immutable version-1 product brief is created.
-- Backfill existing promoted records only after the marker column exists.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS product_promoted_at timestamptz;

UPDATE arsy_opportunities AS opportunity
SET product_promoted_at = COALESCE(product.created_at, now())
FROM arsy_products AS product
WHERE product.owner_id = opportunity.owner_id
  AND product.opportunity_id = opportunity.id
  AND opportunity.product_promoted_at IS NULL;

CREATE INDEX IF NOT EXISTS arsy_opportunities_promoted_idx
  ON arsy_opportunities (owner_id, product_promoted_at)
  WHERE product_promoted_at IS NOT NULL;
