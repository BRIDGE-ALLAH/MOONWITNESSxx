-- Opportunity vertical slice only. Product, asset, channel and finance tables are
-- introduced with their consuming services in later migrations, not as unused scaffolding.
-- Apply through deployment/System Mode; never auto-run schema mutations on app startup.

CREATE TABLE IF NOT EXISTS arsy_opportunities (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 180),
  buyer_problem text NOT NULL,
  buyer_segment text NOT NULL,
  job_to_be_done text NOT NULL,
  product_hypothesis text NOT NULL,
  product_family text NOT NULL,
  candidate_channels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(candidate_channels) = 'array'),
  evidence jsonb NOT NULL
    CHECK (jsonb_typeof(evidence) = 'array' AND jsonb_array_length(evidence) > 0),
  scores jsonb NOT NULL
    CHECK (jsonb_typeof(scores) = 'object'),
  score_details jsonb NOT NULL
    CHECK (jsonb_typeof(score_details) = 'object'),
  hard_gates jsonb NOT NULL
    CHECK (jsonb_typeof(hard_gates) = 'object'),
  hard_gate_details jsonb NOT NULL
    CHECK (jsonb_typeof(hard_gate_details) = 'object'),
  score numeric(5,2) CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  decision text NOT NULL CHECK (decision IN ('blocked', 'research-more', 'prototype-candidate', 'park')),
  decision_rationale text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL
);

CREATE INDEX IF NOT EXISTS arsy_opportunities_owner_updated_idx
  ON arsy_opportunities (owner_id, updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS arsy_opportunities_decision_idx
  ON arsy_opportunities (owner_id, decision) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS arsy_commerce_audit_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  action text NOT NULL,
  actor_id text NOT NULL,
  request_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS arsy_commerce_audit_aggregate_idx
  ON arsy_commerce_audit_events (owner_id, aggregate_type, aggregate_id, occurred_at DESC);
