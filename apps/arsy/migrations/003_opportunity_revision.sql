-- Add optimistic concurrency to editable opportunities without mutating an applied migration.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1
  CHECK (revision > 0);


-- Preserve the immutable product-brief boundary for records promoted before this migration.
UPDATE arsy_opportunities AS opportunity
SET product_promoted_at = COALESCE(product.created_at, now())
FROM arsy_products AS product
WHERE product.owner_id = opportunity.owner_id
  AND product.opportunity_id = opportunity.id
  AND opportunity.product_promoted_at IS NULL;
