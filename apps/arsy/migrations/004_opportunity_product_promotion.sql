-- Persist the opportunity-to-product freeze boundary used by ARSY repositories.
-- Existing products imply their source opportunity was already promoted; preserve that
-- invariant when upgrading a database that predates this explicit marker.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS product_promoted_at timestamptz;

UPDATE arsy_opportunities AS opportunity
SET product_promoted_at = COALESCE(product.created_at, now())
FROM arsy_products AS product
WHERE product.owner_id = opportunity.owner_id
  AND product.opportunity_id = opportunity.id
  AND opportunity.product_promoted_at IS NULL;

CREATE INDEX IF NOT EXISTS arsy_opportunities_unpromoted_owner_idx
  ON arsy_opportunities (owner_id, updated_at DESC)
  WHERE archived_at IS NULL AND product_promoted_at IS NULL;
