-- Shared, owner-scoped login attempt buckets for the Headquarter operator boundary.
-- Apply through the reviewed migration process; application startup never mutates schema.
CREATE TABLE IF NOT EXISTS arsy_login_attempt_buckets (
  owner_id text NOT NULL
    CHECK (length(owner_id) BETWEEN 1 AND 128),
  bucket_key text NOT NULL
    CHECK (bucket_key = 'account' OR bucket_key ~ '^network:[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL
    CHECK (attempt_count BETWEEN 1 AND 6),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, bucket_key)
);

CREATE INDEX IF NOT EXISTS arsy_login_attempt_buckets_blocked_idx
  ON arsy_login_attempt_buckets (blocked_until)
  WHERE blocked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS arsy_login_attempt_buckets_cleanup_idx
  ON arsy_login_attempt_buckets (owner_id, updated_at);
