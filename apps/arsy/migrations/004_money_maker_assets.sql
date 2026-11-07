-- Persistent digital asset bytes are stored by an explicit storage adapter.
-- Provenance and inspection history are owner-scoped and append-only.
CREATE TABLE IF NOT EXISTS arsy_assets (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  product_id uuid NOT NULL,
  product_version integer NOT NULL CHECK (product_version > 0),
  file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  storage_key text NOT NULL UNIQUE,
  sha256 char(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) >= 8),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, product_id) REFERENCES arsy_products (owner_id, id),
  FOREIGN KEY (product_id, product_version) REFERENCES arsy_product_versions (product_id, version)
);

CREATE INDEX IF NOT EXISTS arsy_assets_owner_product_idx
  ON arsy_assets (owner_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arsy_asset_provenance (
  asset_id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  source_asset_id uuid,
  source_reference text,
  creator text NOT NULL,
  license text NOT NULL,
  permission_basis text NOT NULL,
  tool_model text,
  edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  disclosure text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  FOREIGN KEY (owner_id, asset_id) REFERENCES arsy_assets (owner_id, id),
  FOREIGN KEY (owner_id, source_asset_id) REFERENCES arsy_assets (owner_id, id)
);

CREATE TABLE IF NOT EXISTS arsy_asset_inspections (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  asset_id uuid NOT NULL,
  inspection_type text NOT NULL CHECK (inspection_type IN ('rights', 'policy', 'technical-qa', 'creative-qa')),
  status text NOT NULL CHECK (status IN ('pass', 'blocked', 'unknown')),
  inspection_source text NOT NULL CHECK (inspection_source IN ('operator-attestation', 'automated-check', 'independent-review')),
  rationale text NOT NULL,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text NOT NULL,
  FOREIGN KEY (owner_id, asset_id) REFERENCES arsy_assets (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_asset_inspections_latest_idx
  ON arsy_asset_inspections (owner_id, asset_id, inspection_type, reviewed_at DESC);
