-- Shared PostgreSQL login throttling survives Headquarter process and replica restarts.
-- Only keyed HMAC digests are stored; raw operator IDs and client IP addresses never enter this table.
CREATE TABLE IF NOT EXISTS arsy_login_attempt_buckets (
  bucket_type text NOT NULL CHECK (bucket_type IN ('operator', 'network')),
  bucket_hash char(64) NOT NULL CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_type, bucket_hash)
);

CREATE INDEX IF NOT EXISTS arsy_login_attempt_blocked_idx
  ON arsy_login_attempt_buckets (blocked_until)
  WHERE blocked_until IS NOT NULL;
