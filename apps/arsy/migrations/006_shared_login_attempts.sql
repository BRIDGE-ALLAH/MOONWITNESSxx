-- Shared login throttling for horizontally scaled Headquarter instances.
-- Apply through the repository's controlled migration procedure; never at app startup.
CREATE TABLE IF NOT EXISTS arsy_login_attempt_buckets (
  owner_id text NOT NULL,
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count BETWEEN 0 AND 5),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, bucket_key),
  CONSTRAINT arsy_login_attempt_bucket_key_check
    CHECK (bucket_key = 'account' OR bucket_key ~ '^network:[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS arsy_login_attempts_expiry_idx
  ON arsy_login_attempt_buckets (updated_at);
