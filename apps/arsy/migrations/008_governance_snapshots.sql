-- Governance Lab snapshot persistence. Owner-scoped, immutable payloads with soft archive.
-- Apply through the deployment/System Mode migration process; application startup never mutates schema.
CREATE TABLE IF NOT EXISTS arsy_governance_snapshots (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 128),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  graph jsonb NOT NULL,
  gate_input jsonb NOT NULL,
  scenario_baseline jsonb NOT NULL,
  scenario jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CHECK (archived_at IS NULL OR archived_at >= created_at)
);

CREATE INDEX IF NOT EXISTS arsy_governance_snapshots_owner_created_idx
  ON arsy_governance_snapshots (owner_id, created_at DESC);

COMMENT ON TABLE arsy_governance_snapshots IS 'Owner-scoped Governance Lab review snapshots; payloads are validated against @riotworks/contract governance schemas before insert.';