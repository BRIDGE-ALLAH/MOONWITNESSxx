-- The parent commerce branch owns opportunity revision migration 003_opportunity_revision.sql.
-- Keep this follow-up migration limited to the audit query index; product version history
-- already has a unique (product_id, version) index that supports descending history reads.
CREATE INDEX IF NOT EXISTS arsy_commerce_audit_owner_time_idx
  ON arsy_commerce_audit_events (owner_id, occurred_at DESC);
