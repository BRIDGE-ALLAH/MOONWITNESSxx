-- Payout lifecycle and exact-rational FX conversion.
-- Additive only: preserve existing payout and financial-event history.

ALTER TABLE arsy_payouts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy-import',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_hash char(64),
  ADD COLUMN IF NOT EXISTS reconciliation_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by text;

UPDATE arsy_payouts
SET idempotency_key = COALESCE(idempotency_key, 'legacy-payout-' || id::text),
    request_hash = COALESCE(request_hash, repeat('0', 64)),
    updated_by = COALESCE(updated_by, created_by)
WHERE idempotency_key IS NULL OR request_hash IS NULL OR updated_by IS NULL;

ALTER TABLE arsy_payouts
  ALTER COLUMN idempotency_key SET NOT NULL,
  ALTER COLUMN request_hash SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_payouts_owner_id_unique'
      AND conrelid = 'arsy_payouts'::regclass
  ) THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_owner_id_unique UNIQUE (owner_id, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_payouts_owner_idempotency_unique'
      AND conrelid = 'arsy_payouts'::regclass
  ) THEN
    ALTER TABLE arsy_payouts ADD CONSTRAINT arsy_payouts_owner_idempotency_unique UNIQUE (owner_id, idempotency_key);
  END IF;
END
$$;

ALTER TABLE arsy_financial_events
  ADD COLUMN IF NOT EXISTS payout_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_financial_events_owner_payout_fk'
      AND conrelid = 'arsy_financial_events'::regclass
  ) THEN
    ALTER TABLE arsy_financial_events
      ADD CONSTRAINT arsy_financial_events_owner_payout_fk
      FOREIGN KEY (owner_id, payout_id) REFERENCES arsy_payouts (owner_id, id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS arsy_financial_events_payout_idx
  ON arsy_financial_events (owner_id, payout_id)
  WHERE payout_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS arsy_payout_events (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  payout_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('pending', 'paid', 'failed', 'reversed', 'disputed')),
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (owner_id, payout_id) REFERENCES arsy_payouts (owner_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_payout_events_history_idx
  ON arsy_payout_events (owner_id, payout_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS arsy_fx_conversions (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  source_event_id uuid NOT NULL,
  from_amount_minor bigint NOT NULL CHECK (from_amount_minor > 0),
  from_currency varchar(3) NOT NULL CHECK (from_currency ~ '^[A-Z]{3}$'),
  to_amount_minor bigint NOT NULL CHECK (to_amount_minor > 0),
  to_currency varchar(3) NOT NULL CHECK (to_currency ~ '^[A-Z]{3}$'),
  rate_numerator numeric(38,0) NOT NULL CHECK (rate_numerator > 0),
  rate_denominator numeric(38,0) NOT NULL CHECK (rate_denominator > 0),
  rate_source text NOT NULL,
  source_url text NOT NULL,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_by text NOT NULL,
  FOREIGN KEY (owner_id, source_event_id) REFERENCES arsy_financial_events (owner_id, id),
  UNIQUE (owner_id, idempotency_key),
  CHECK (from_currency <> to_currency)
);

CREATE INDEX IF NOT EXISTS arsy_fx_conversions_owner_recorded_idx
  ON arsy_fx_conversions (owner_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS arsy_fx_conversions_source_event_idx
  ON arsy_fx_conversions (owner_id, source_event_id);
