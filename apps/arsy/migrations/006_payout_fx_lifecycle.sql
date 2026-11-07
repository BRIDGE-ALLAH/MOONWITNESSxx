ALTER TABLE arsy_payouts
  ADD COLUMN IF NOT EXISTS listing_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_hash char(64),
  ADD COLUMN IF NOT EXISTS paid_financial_event_id uuid,
  ADD COLUMN IF NOT EXISTS reversal_financial_event_id uuid,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS dispute_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arsy_payouts_owner_id_unique') THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_owner_id_unique UNIQUE (owner_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arsy_payouts_owner_idempotency_unique') THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_owner_idempotency_unique UNIQUE (owner_id, idempotency_key);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arsy_payouts_listing_owner_fk') THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_listing_owner_fk
      FOREIGN KEY (owner_id, listing_id) REFERENCES arsy_listings (owner_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arsy_payouts_paid_financial_fk') THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_paid_financial_fk
      FOREIGN KEY (owner_id, paid_financial_event_id) REFERENCES arsy_financial_events (owner_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'arsy_payouts_reversal_financial_fk') THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_reversal_financial_fk
      FOREIGN KEY (owner_id, reversal_financial_event_id) REFERENCES arsy_financial_events (owner_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS arsy_payout_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  payout_id uuid NOT NULL,
  from_status text CHECK (from_status IS NULL OR from_status IN ('pending', 'paid', 'failed', 'reversed', 'disputed')),
  to_status text NOT NULL CHECK (to_status IN ('pending', 'paid', 'failed', 'reversed', 'disputed')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_reference text,
  evidence_url text,
  source text NOT NULL,
  rationale text,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_by text NOT NULL,
  UNIQUE (owner_id, idempotency_key),
  FOREIGN KEY (owner_id, payout_id) REFERENCES arsy_payouts (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_payout_events_history_idx
  ON arsy_payout_events (owner_id, payout_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS arsy_fx_conversions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  source_event_id uuid NOT NULL,
  from_currency varchar(3) NOT NULL CHECK (from_currency ~ '^[A-Z]{3}$'),
  to_currency varchar(3) NOT NULL CHECK (to_currency ~ '^[A-Z]{3}$' AND to_currency <> from_currency),
  from_amount_minor bigint NOT NULL CHECK (from_amount_minor > 0),
  to_amount_minor bigint NOT NULL CHECK (to_amount_minor > 0),
  rate_numerator numeric(38,0) NOT NULL CHECK (rate_numerator > 0),
  rate_denominator numeric(38,0) NOT NULL CHECK (rate_denominator > 0),
  rate_source text NOT NULL,
  rate_observed_at timestamptz NOT NULL,
  evidence_url text NOT NULL,
  rounding_mode text NOT NULL CHECK (rounding_mode IN ('half-up', 'half-even')),
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  UNIQUE (owner_id, idempotency_key),
  UNIQUE (owner_id, source_event_id, to_currency),
  FOREIGN KEY (owner_id, source_event_id) REFERENCES arsy_financial_events (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_fx_conversions_owner_created_idx
  ON arsy_fx_conversions (owner_id, created_at DESC);
