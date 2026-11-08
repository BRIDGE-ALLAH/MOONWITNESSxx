-- ARSY-owned deployment state and durable operation journal.
-- Apply through the reviewed System Mode/deployment migration process.
-- Application startup must never mutate schema.
CREATE TABLE IF NOT EXISTS arsy_deployments (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  docker_server_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  desired_image_digest text,
  desired_config jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(desired_config) = 'object'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'deploying', 'verifying', 'healthy', 'degraded', 'failed', 'stopped')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (desired_image_digest IS NULL OR desired_image_digest ~ '^sha256:[a-f0-9]{64}$'),
  UNIQUE (owner_id, name),
  UNIQUE (id, owner_id),
  FOREIGN KEY (docker_server_id, owner_id)
    REFERENCES docker_connector_servers (id, owner_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS arsy_deployments_owner_updated_idx
  ON arsy_deployments (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS arsy_deployment_operations (
  id uuid PRIMARY KEY,
  deployment_id uuid NOT NULL,
  owner_id text NOT NULL,
  actor_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deploy', 'stop', 'restart', 'rollback')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'verifying', 'succeeded', 'failed', 'cancelled', 'blocked')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(request_payload) = 'object'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_until timestamptz,
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (owner_id, idempotency_key),
  UNIQUE (id, owner_id),
  FOREIGN KEY (deployment_id, owner_id)
    REFERENCES arsy_deployments (id, owner_id) ON DELETE RESTRICT,
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL)),
  CHECK ((status IN ('succeeded', 'failed', 'cancelled', 'blocked')) = (completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS arsy_deployment_operations_owner_created_idx
  ON arsy_deployment_operations (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS arsy_deployment_operations_dispatch_idx
  ON arsy_deployment_operations (status, available_at, created_at)
  WHERE status IN ('queued', 'running', 'verifying');

CREATE TABLE IF NOT EXISTS arsy_deployment_operation_events (
  operation_id uuid NOT NULL,
  owner_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 100),
  from_status text,
  to_status text NOT NULL
    CHECK (to_status IN ('queued', 'running', 'verifying', 'succeeded', 'failed', 'cancelled', 'blocked')),
  actor_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation_id, sequence),
  FOREIGN KEY (operation_id, owner_id)
    REFERENCES arsy_deployment_operations (id, owner_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS arsy_deployment_operation_events_owner_time_idx
  ON arsy_deployment_operation_events (owner_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS arsy_deployment_outbox (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL,
  owner_id text NOT NULL,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 120),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_until timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id, event_type),
  FOREIGN KEY (operation_id, owner_id)
    REFERENCES arsy_deployment_operations (id, owner_id) ON DELETE RESTRICT,
  CHECK ((locked_by IS NULL) = (locked_until IS NULL))
);

CREATE INDEX IF NOT EXISTS arsy_deployment_outbox_claim_idx
  ON arsy_deployment_outbox (available_at, created_at)
  WHERE delivered_at IS NULL;

CREATE OR REPLACE FUNCTION reject_arsy_deployment_operation_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'arsy_deployment_operation_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS arsy_deployment_operation_events_immutable
  ON arsy_deployment_operation_events;
CREATE TRIGGER arsy_deployment_operation_events_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_operation_events
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_operation_event_mutation();

COMMENT ON TABLE arsy_deployments IS
  'ARSY canonical application deployment aggregates. Secret values must never be stored in desired_config.';
COMMENT ON TABLE arsy_deployment_operations IS
  'Durable, owner-scoped deployment operations with request idempotency and worker lease fields.';
COMMENT ON TABLE arsy_deployment_operation_events IS
  'Append-only audit history for deployment operation state transitions.';
COMMENT ON TABLE arsy_deployment_outbox IS
  'Transactional dispatch outbox; transport delivery is not canonical business state.';
