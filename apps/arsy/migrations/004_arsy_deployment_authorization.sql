-- Append-only authorization evidence for ARSY deployment operations.
-- Apply only through the reviewed migration process; never at application startup.
CREATE TABLE IF NOT EXISTS arsy_deployment_authorization_decisions (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL,
  owner_id text NOT NULL,
  actor_id text NOT NULL,
  target_host_id uuid NOT NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 64),
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  reason_code text NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 120),
  policy_version text,
  approval_reference text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(evidence) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (operation_id, owner_id)
    REFERENCES arsy_deployment_operations (id, owner_id) ON DELETE RESTRICT,
  CHECK (policy_version IS NULL OR length(policy_version) BETWEEN 1 AND 120),
  CHECK (approval_reference IS NULL OR length(approval_reference) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS arsy_deployment_authorization_owner_time_idx
  ON arsy_deployment_authorization_decisions (owner_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS arsy_deployment_authorization_operation_idx
  ON arsy_deployment_authorization_decisions (operation_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION reject_arsy_deployment_authorization_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'arsy_deployment_authorization_decisions is append-only';
END;
$$;

DROP TRIGGER IF EXISTS arsy_deployment_authorization_decisions_immutable
  ON arsy_deployment_authorization_decisions;
CREATE TRIGGER arsy_deployment_authorization_decisions_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_authorization_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_authorization_mutation();

COMMENT ON TABLE arsy_deployment_authorization_decisions IS
  'Append-only policy and approval evidence for deployment operations. Evidence must contain references and decision metadata, never secret values.';
