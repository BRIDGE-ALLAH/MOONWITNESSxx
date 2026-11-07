-- Shared single-operator login throttling across ARSY / Headquarter instances.
-- Only a keyed network fingerprint is stored; raw client IP addresses are never persisted.
CREATE TABLE IF NOT EXISTS arsy_login_attempt_buckets (
  owner_id text NOT NULL,
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  failure_count integer NOT NULL CHECK (failure_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, bucket_key)
);

CREATE INDEX IF NOT EXISTS arsy_login_attempts_expiry_idx
  ON arsy_login_attempt_buckets (blocked_until)
  WHERE blocked_until IS NOT NULL;
