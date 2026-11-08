-- Deployment authorization evidence and trusted, operation-scoped capability grants.
-- Grant/approval provisioning is intentionally out-of-band and must use a trusted signer.
-- Application startup must never mutate schema.
CREATE TABLE IF NOT EXISTS arsy_deployment_capability_grants (
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 160),
  owner_id text NOT NULL,
  parent_grant_id text,
  issuer_id text NOT NULL CHECK (length(issuer_id) BETWEEN 1 AND 160),
  subject_id text NOT NULL CHECK (length(subject_id) BETWEEN 1 AND 160),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 160),
  purpose text NOT NULL CHECK (length(purpose) BETWEEN 1 AND 160),
  session_id text NOT NULL CHECK (length(session_id) BETWEEN 1 AND 200),
  actions jsonb NOT NULL CHECK (jsonb_typeof(actions) = 'array'),
  resources jsonb NOT NULL CHECK (jsonb_typeof(resources) = 'array'),
  argument_hashes jsonb NOT NULL CHECK (jsonb_typeof(argument_hashes) = 'array'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  signature text NOT NULL CHECK (length(signature) BETWEEN 80 AND 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  CHECK (expires_at > issued_at),
  FOREIGN KEY (owner_id, parent_grant_id)
    REFERENCES arsy_deployment_capability_grants (owner_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS arsy_deployment_capability_grants_scope_idx
  ON arsy_deployment_capability_grants (owner_id, tenant_id, purpose, session_id, subject_id);

CREATE TABLE IF NOT EXISTS arsy_deployment_capability_revocations (
  owner_id text NOT NULL,
  grant_id text NOT NULL,
  revoked_by text NOT NULL,
  reason_code text NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 120),
  revoked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, grant_id),
  FOREIGN KEY (owner_id, grant_id)
    REFERENCES arsy_deployment_capability_grants (owner_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS arsy_deployment_approvals (
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 160),
  owner_id text NOT NULL,
  operation_id uuid NOT NULL,
  requested_actor_id text NOT NULL,
  approver_id text NOT NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  resource text NOT NULL CHECK (length(resource) BETWEEN 1 AND 400),
  policy_version text NOT NULL CHECK (length(policy_version) BETWEEN 1 AND 120),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason_code text NOT NULL CHECK (length(reason_code) BETWEEN 1 AND 120),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  signature text NOT NULL CHECK (length(signature) BETWEEN 80 AND 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, operation_id),
  CHECK (approver_id <> requested_actor_id),
  CHECK (expires_at > issued_at),
  FOREIGN KEY (operation_id, owner_id)
    REFERENCES arsy_deployment_operations (id, owner_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS arsy_deployment_authorization_decisions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  operation_id uuid NOT NULL,
  docker_server_id uuid NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource text NOT NULL,
  argument_hash char(64) NOT NULL CHECK (argument_hash ~ '^[a-f0-9]{64}$'),
  policy_version text,
  allowed boolean NOT NULL,
  reason_codes jsonb NOT NULL CHECK (jsonb_typeof(reason_codes) = 'array'),
  capability_grant_id text,
  approval_id text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (operation_id, owner_id)
    REFERENCES arsy_deployment_operations (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (docker_server_id, owner_id)
    REFERENCES docker_connector_servers (id, owner_id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, capability_grant_id)
    REFERENCES arsy_deployment_capability_grants (owner_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (owner_id, approval_id)
    REFERENCES arsy_deployment_approvals (owner_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS arsy_deployment_authorization_decisions_operation_idx
  ON arsy_deployment_authorization_decisions (owner_id, operation_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION reject_arsy_deployment_authorization_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'deployment authorization evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS arsy_deployment_capability_grants_immutable
  ON arsy_deployment_capability_grants;
CREATE TRIGGER arsy_deployment_capability_grants_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_capability_grants
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_authorization_mutation();

DROP TRIGGER IF EXISTS arsy_deployment_capability_revocations_immutable
  ON arsy_deployment_capability_revocations;
CREATE TRIGGER arsy_deployment_capability_revocations_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_capability_revocations
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_authorization_mutation();

DROP TRIGGER IF EXISTS arsy_deployment_approvals_immutable
  ON arsy_deployment_approvals;
CREATE TRIGGER arsy_deployment_approvals_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_approvals
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_authorization_mutation();

DROP TRIGGER IF EXISTS arsy_deployment_authorization_decisions_immutable
  ON arsy_deployment_authorization_decisions;
CREATE TRIGGER arsy_deployment_authorization_decisions_immutable
  BEFORE UPDATE OR DELETE ON arsy_deployment_authorization_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_arsy_deployment_authorization_mutation();

COMMENT ON TABLE arsy_deployment_capability_grants IS
  'Signed, operation-scoped ARSY capability grants provisioned only by a trusted external issuer; no public issuance endpoint exists.';
COMMENT ON TABLE arsy_deployment_capability_revocations IS
  'Append-only revocation records for signed deployment capability grants.';
COMMENT ON TABLE arsy_deployment_approvals IS
  'Signed approval/rejection evidence; approver must be distinct from the requesting actor.';
COMMENT ON TABLE arsy_deployment_authorization_decisions IS
  'Immutable decision evidence binding actor, operation, Docker target, capability, policy and approval outcome.';
