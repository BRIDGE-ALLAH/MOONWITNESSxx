-- ORACLE-owned durable computation jobs. Apply only with the explicit ORACLE migration role.
CREATE TABLE oracle.jobs (
  job_id uuid PRIMARY KEY,
  task_type text NOT NULL CHECK (task_type IN ('statistics.describe', 'text.profile')),
  input_payload jsonb NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_digest char(64) NOT NULL,
  request_digest char(64) NOT NULL,
  idempotency_key varchar(128),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error jsonb,
  provenance jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner uuid,
  lease_token uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oracle_jobs_terminal_result_check CHECK (
    (status = 'succeeded' AND result IS NOT NULL AND completed_at IS NOT NULL AND provenance IS NOT NULL AND error IS NULL)
    OR (status = 'failed' AND completed_at IS NOT NULL AND error IS NOT NULL)
    OR (status IN ('queued', 'running') AND completed_at IS NULL AND result IS NULL AND error IS NULL)
  ),
  CONSTRAINT oracle_jobs_lease_check CHECK (
    (status = 'running' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'running' AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
  )
);

CREATE UNIQUE INDEX oracle_jobs_idempotency_key_idx
  ON oracle.jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX oracle_jobs_queue_idx
  ON oracle.jobs (submitted_at, job_id)
  WHERE status = 'queued';

CREATE INDEX oracle_jobs_expired_lease_idx
  ON oracle.jobs (lease_expires_at, submitted_at)
  WHERE status = 'running';

CREATE INDEX oracle_jobs_retention_idx
  ON oracle.jobs (completed_at, job_id)
  WHERE status IN ('succeeded', 'failed');

-- Grant the runtime principal access to this table only; migration history and future
-- tables remain private to the schema owner unless a reviewed migration grants them.
GRANT USAGE ON SCHEMA oracle TO oracle_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE oracle.jobs TO oracle_app;
