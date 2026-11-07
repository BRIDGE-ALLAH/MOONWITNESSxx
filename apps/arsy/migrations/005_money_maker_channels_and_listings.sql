-- Channel registry and manual listing workflow. No external publishing integration is enabled.
CREATE TABLE IF NOT EXISTS arsy_channels (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  channel_key text NOT NULL,
  display_name text NOT NULL,
  country_code char(2) NOT NULL,
  account_eligibility text NOT NULL CHECK (account_eligibility IN ('eligible', 'ineligible', 'unknown')),
  official_policy_url text,
  policy_reviewed_at timestamptz,
  policy_recheck_at timestamptz,
  payout_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  payout_setup_status text NOT NULL CHECK (payout_setup_status IN ('configured', 'not-configured', 'unavailable', 'unknown')),
  capability text NOT NULL CHECK (capability IN ('C0', 'C1')),
  granted_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  quota_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_status text NOT NULL DEFAULT 'active' CHECK (channel_status IN ('active', 'paused')),
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, channel_key)
);

CREATE INDEX IF NOT EXISTS arsy_channels_owner_status_idx
  ON arsy_channels (owner_id, channel_status, display_name);

CREATE TABLE IF NOT EXISTS arsy_channel_evidence (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  channel_id uuid NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('official-policy', 'account-eligibility', 'payout-requirements', 'api-capability', 'other')),
  source_name text NOT NULL,
  source_url text NOT NULL,
  captured_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  evidence_class text NOT NULL CHECK (evidence_class IN ('observed-fact', 'operator-attestation', 'inference', 'unknown')),
  summary text NOT NULL,
  limitations text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  FOREIGN KEY (owner_id, channel_id) REFERENCES arsy_channels (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_channel_evidence_history_idx
  ON arsy_channel_evidence (owner_id, channel_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS arsy_listings (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  product_id uuid NOT NULL,
  product_version integer NOT NULL CHECK (product_version > 0),
  channel_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('blocked', 'ready', 'submitted', 'published', 'withdrawn')),
  listing_package jsonb NOT NULL,
  package_hash char(64) NOT NULL CHECK (package_hash ~ '^[a-f0-9]{64}$'),
  readiness_snapshot jsonb NOT NULL,
  disclosure text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) >= 8),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  published_at timestamptz,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, product_id) REFERENCES arsy_products (owner_id, id),
  FOREIGN KEY (product_id, product_version) REFERENCES arsy_product_versions (product_id, version),
  FOREIGN KEY (owner_id, channel_id) REFERENCES arsy_channels (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_listings_owner_status_idx
  ON arsy_listings (owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS arsy_publication_receipts (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  listing_id uuid NOT NULL,
  receipt_type text NOT NULL CHECK (receipt_type IN ('manual-submission', 'publication-confirmation', 'withdrawal-confirmation')),
  external_listing_id text,
  public_url text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  operator_confirmation text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NOT NULL,
  UNIQUE (owner_id, id),
  FOREIGN KEY (owner_id, listing_id) REFERENCES arsy_listings (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_publication_receipts_listing_idx
  ON arsy_publication_receipts (owner_id, listing_id, captured_at DESC);
