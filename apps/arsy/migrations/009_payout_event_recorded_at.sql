-- Separate provider-event occurrence from our database recording timestamp.
-- Existing history keeps its original occurred_at; recorded_at is backfilled at migration time.
ALTER TABLE arsy_payout_events
  ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS arsy_payout_events_recorded_history_idx
  ON arsy_payout_events (owner_id, payout_id, recorded_at DESC);
