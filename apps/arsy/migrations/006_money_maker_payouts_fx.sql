-- Manual payout statement ingestion, auditable payout lifecycle and exact rational FX conversions.
CREATE TABLE IF NOT EXISTS arsy_payout_statements (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  channel_id uuid NOT NULL,
  provider_name text NOT NULL,
  statement_reference text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  evidence_url text NOT NULL,
  row_count integer NOT NULL CHECK (row_count > 0),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) >= 8),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CHECK (period_end >= period_start),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  UNIQUE (owner_id, provider_name, statement_reference),
  FOREIGN KEY (owner_id, channel_id) REFERENCES arsy_channels (owner_id, id)
);

CREATE TABLE IF NOT EXISTS arsy_payout_statement_rows (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  statement_id uuid NOT NULL,
  row_number integer NOT NULL CHECK (row_number > 0),
  provider_reference text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, statement_id, row_number),
  UNIQUE (owner_id, provider_reference),
  FOREIGN KEY (owner_id, statement_id) REFERENCES arsy_payout_statements (owner_id, id)
);

CREATE TABLE IF NOT EXISTS arsy_payouts (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  channel_id uuid NOT NULL,
  statement_id uuid NOT NULL,
  statement_row_id uuid NOT NULL,
  provider_name text NOT NULL,
  provider_reference text NOT NULL,
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL CHECK (status IN ('expected', 'paid', 'failed', 'reversed', 'disputed')),
  expected_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,
  disputed_at timestamptz,
  paid_financial_event_id uuid,
  reversal_financial_event_id uuid,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  updated_by text NOT NULL,
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, channel_id, provider_reference),
  UNIQUE (owner_id, statement_row_id),
  FOREIGN KEY (owner_id, channel_id) REFERENCES arsy_channels (owner_id, id),
  FOREIGN KEY (owner_id, statement_id) REFERENCES arsy_payout_statements (owner_id, id),
  FOREIGN KEY (owner_id, statement_row_id) REFERENCES arsy_payout_statement_rows (owner_id, id),
  FOREIGN KEY (owner_id, paid_financial_event_id) REFERENCES arsy_financial_events (owner_id, id),
  FOREIGN KEY (owner_id, reversal_financial_event_id) REFERENCES arsy_financial_events (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_payouts_owner_status_idx
  ON arsy_payouts (owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS arsy_payout_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  payout_id uuid NOT NULL,
  from_status text CHECK (from_status IS NULL OR from_status IN ('expected', 'paid', 'failed', 'reversed', 'disputed')),
  to_status text NOT NULL CHECK (to_status IN ('expected', 'paid', 'failed', 'reversed', 'disputed')),
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) >= 8),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  recorded_by text NOT NULL,
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, payout_id) REFERENCES arsy_payouts (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_payout_events_history_idx
  ON arsy_payout_events (owner_id, payout_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS arsy_fx_conversions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  source_financial_event_id uuid,
  source_payout_id uuid,
  base_currency char(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency char(3) NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  original_amount_minor bigint NOT NULL CHECK (original_amount_minor > 0),
  converted_amount_minor bigint NOT NULL CHECK (converted_amount_minor > 0),
  rate_numerator numeric(38, 0) NOT NULL CHECK (rate_numerator > 0),
  rate_denominator numeric(38, 0) NOT NULL CHECK (rate_denominator > 0),
  rate_source text NOT NULL,
  rate_source_url text NOT NULL,
  observed_at timestamptz NOT NULL,
  rounding_mode text NOT NULL CHECK (rounding_mode = 'half-up'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) >= 8),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  CHECK (base_currency <> quote_currency),
  CHECK ((source_financial_event_id IS NOT NULL)::integer + (source_payout_id IS NOT NULL)::integer = 1),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, source_financial_event_id) REFERENCES arsy_financial_events (owner_id, id),
  FOREIGN KEY (owner_id, source_payout_id) REFERENCES arsy_payouts (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_fx_conversions_owner_time_idx
  ON arsy_fx_conversions (owner_id, observed_at DESC);
