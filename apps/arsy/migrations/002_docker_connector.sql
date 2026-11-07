-- Docker connector metadata only. TLS private keys are AES-256-GCM encrypted by ARSY.
-- Apply through the deployment/System Mode migration process; application startup never mutates schema.
CREATE TABLE IF NOT EXISTS docker_connector_servers (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('local', 'remote')),
  endpoint_url text,
  encrypted_credentials text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'local' AND endpoint_url IS NULL AND encrypted_credentials IS NULL)
    OR
    (kind = 'remote' AND endpoint_url IS NOT NULL AND encrypted_credentials IS NOT NULL)
  ),
  UNIQUE (owner_id, name),
  UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS docker_connector_servers_owner_created_idx
  ON docker_connector_servers (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS docker_connector_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id text NOT NULL,
  server_id uuid NOT NULL,
  action text NOT NULL,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (server_id, owner_id) REFERENCES docker_connector_servers (id, owner_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS docker_connector_audit_events_server_time_idx
  ON docker_connector_audit_events (server_id, occurred_at DESC);

COMMENT ON TABLE docker_connector_servers IS 'Owner-scoped Docker Engine connection metadata; remote TLS private material is encrypted at application layer.';
COMMENT ON TABLE docker_connector_audit_events IS 'Append-only audit events for Docker connector control-plane actions.';

CREATE OR REPLACE FUNCTION reject_docker_connector_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'docker_connector_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS docker_connector_audit_immutable ON docker_connector_audit_events;
CREATE TRIGGER docker_connector_audit_immutable
  BEFORE UPDATE OR DELETE ON docker_connector_audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_docker_connector_audit_mutation();
