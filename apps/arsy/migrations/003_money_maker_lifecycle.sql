-- Add optimistic concurrency for operator-authored opportunity edits.
-- Product versions remain append-only; no historical version is rewritten.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS arsy_product_versions_history_idx
  ON arsy_product_versions (product_id, version DESC);

CREATE INDEX IF NOT EXISTS arsy_commerce_audit_owner_time_idx
  ON arsy_commerce_audit_events (owner_id, occurred_at DESC);
