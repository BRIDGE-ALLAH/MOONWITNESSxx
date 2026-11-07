-- Apply through deployment/System Mode. Never auto-run schema mutations on app startup.
CREATE TABLE IF NOT EXISTS arsy_opportunities (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  title text NOT NULL,
  buyer_problem text NOT NULL,
  buyer_segment text NOT NULL,
  job_to_be_done text NOT NULL,
  product_hypothesis text NOT NULL,
  product_family text NOT NULL,
  candidate_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL,
  scores jsonb NOT NULL,
  hard_gates jsonb NOT NULL,
  score numeric(5,2),
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

CREATE TABLE IF NOT EXISTS arsy_products (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  opportunity_id uuid REFERENCES arsy_opportunities(id),
  title text NOT NULL,
  product_family text NOT NULL,
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('brief', 'production', 'review', 'ready', 'listed', 'retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL
);
CREATE INDEX IF NOT EXISTS arsy_products_owner_updated_idx
  ON arsy_products (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS arsy_product_versions (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES arsy_products(id),
  version integer NOT NULL CHECK (version > 0),
  brief jsonb NOT NULL,
  acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE (product_id, version)
);

CREATE TABLE IF NOT EXISTS arsy_assets (
  id uuid PRIMARY KEY,
  product_version_id uuid NOT NULL REFERENCES arsy_product_versions(id),
  owner_id text NOT NULL,
  filename text NOT NULL,
  media_type text NOT NULL,
  storage_key text NOT NULL,
  checksum_sha256 char(64),
  provenance jsonb NOT NULL,
  rights_state text NOT NULL CHECK (rights_state IN ('pass', 'blocked', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);
CREATE INDEX IF NOT EXISTS arsy_assets_owner_created_idx
  ON arsy_assets (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arsy_inspections (
  id uuid PRIMARY KEY,
  product_version_id uuid NOT NULL REFERENCES arsy_product_versions(id),
  inspection_type text NOT NULL CHECK (inspection_type IN ('rights', 'policy', 'technical', 'creative')),
  status text NOT NULL CHECK (status IN ('pass', 'warning', 'blocked', 'needs-review')),
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  inspected_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS arsy_channels (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  capability text NOT NULL CHECK (capability IN ('C0', 'C1', 'C2', 'C3', 'C4')),
  country_eligibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_url text,
  policy_checked_at timestamptz,
  payout_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arsy_listings (
  id uuid PRIMARY KEY,
  product_version_id uuid NOT NULL REFERENCES arsy_product_versions(id),
  channel_id uuid NOT NULL REFERENCES arsy_channels(id),
  owner_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'ready', 'submitted', 'published', 'rejected', 'withdrawn')),
  listing_package jsonb NOT NULL,
  provider_reference text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  UNIQUE (product_version_id, channel_id)
);

CREATE TABLE IF NOT EXISTS arsy_financial_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  product_id uuid REFERENCES arsy_products(id),
  listing_id uuid REFERENCES arsy_listings(id),
  event_type text NOT NULL CHECK (event_type IN ('gross-receipt', 'platform-fee', 'refund', 'chargeback', 'variable-cost', 'production-cost', 'tax-reserve', 'fx-adjustment', 'payout', 'payout-reversal')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  provider_reference text,
  idempotency_key text NOT NULL,
  reconciliation_state text NOT NULL CHECK (reconciliation_state IN ('pending', 'verified', 'disputed', 'reversed')),
  fx_rate numeric(24,12),
  fx_source text,
  fx_observed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL,
  UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS arsy_financial_events_owner_occurred_idx
  ON arsy_financial_events (owner_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS arsy_financial_events_product_idx
  ON arsy_financial_events (product_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS arsy_payouts (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  channel_id uuid REFERENCES arsy_channels(id),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'reversed', 'disputed')),
  provider_reference text,
  expected_at timestamptz,
  paid_at timestamptz,
  source_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

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

CREATE TABLE IF NOT EXISTS arsy_commerce_idempotency (
  owner_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, idempotency_key)
);
