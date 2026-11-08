-- ORACLE-owned durable computation job lifecycle.
-- Apply explicitly using the reviewed database migration process; never at application startup.
CREATE SCHEMA IF NOT EXISTS oracle;

CREATE TABLE IF NOT EXISTS oracle.jobs (
  job_id uuid PRIMARY KEY,
  task_type text NOT NULL CHECK (task_type IN ('statistics.describe', 'text.profile')),
  input_payload jsonb NOT NULL CHECK (jsonb_typeof(input_payload) = 'object'),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  request_digest char(64) NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  input_digest char(64) NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  idempotency_key varchar(128),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  result_payload jsonb CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object'),
  error_payload jsonb CHECK (error_payload IS NULL OR jsonb_typeof(error_payload) = 'object'),
  provenance_payload jsonb CHECK (provenance_payload IS NULL OR jsonb_typeof(provenance_payload) = 'object'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_owner text,
  lease_until timestamptz,
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL)),
  CHECK ((status = 'running') = (lease_owner IS NOT NULL)),
  CHECK ((status IN ('succeeded', 'failed')) = (completed_at IS NOT NULL)),
  CHECK (status <> 'succeeded' OR (result_payload IS NOT NULL AND provenance_payload IS NOT NULL AND error_payload IS NULL)),
  CHECK (status <> 'failed' OR (error_payload IS NOT NULL AND result_payload IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS oracle_jobs_idempotency_key_unique
  ON oracle.jobs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS oracle_jobs_claim_idx
  ON oracle.jobs (submitted_at, job_id)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS oracle_jobs_queue_depth_idx
  ON oracle.jobs (job_id)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS oracle_jobs_terminal_retention_idx
  ON oracle.jobs (completed_at, job_id)
  WHERE status IN ('succeeded', 'failed');

COMMENT ON SCHEMA oracle IS
  'ORACLE-owned computation job metadata and bounded results; not canonical evidence or audit storage.';
COMMENT ON TABLE oracle.jobs IS
  'Durable ORACLE computation queue. Inputs/results are bounded by API schemas and subject to configured retention.';
COMMENT ON COLUMN oracle.jobs.lease_owner IS
  'Unique worker fencing token. Only the current lease owner may persist a terminal result.';
COMMENT ON COLUMN oracle.jobs.idempotency_key IS
  'Optional global service idempotency key, retained only as long as its associated terminal job.';


-- Keep the application login separate from the migration/owner identity.
-- The role is provisioned before this migration by the reviewed bootstrap step.
REVOKE ALL ON SCHEMA oracle FROM PUBLIC;
DO $oracle_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'oracle_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA oracle TO oracle_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE oracle.jobs TO oracle_app';
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA oracle GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO oracle_app',
      current_user
    );
  END IF;
END
$oracle_grants$;
