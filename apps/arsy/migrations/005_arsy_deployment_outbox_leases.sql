-- ARSY outbox lease fencing and terminal dead-letter state.
-- A delivery is at-least-once; the stable outbox ID is the handler idempotency key.
-- Application startup must never mutate schema.
ALTER TABLE arsy_deployment_outbox
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_deployment_outbox_attempt_limit_check'
      AND conrelid = 'arsy_deployment_outbox'::regclass
  ) THEN
    ALTER TABLE arsy_deployment_outbox
      ADD CONSTRAINT arsy_deployment_outbox_attempt_limit_check
      CHECK (max_attempts BETWEEN 1 AND 25);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_deployment_outbox_lease_token_check'
      AND conrelid = 'arsy_deployment_outbox'::regclass
  ) THEN
    ALTER TABLE arsy_deployment_outbox
      ADD CONSTRAINT arsy_deployment_outbox_lease_token_check
      CHECK ((locked_by IS NULL) = (lease_token IS NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_deployment_outbox_terminal_state_check'
      AND conrelid = 'arsy_deployment_outbox'::regclass
  ) THEN
    ALTER TABLE arsy_deployment_outbox
      ADD CONSTRAINT arsy_deployment_outbox_terminal_state_check
      CHECK (delivered_at IS NULL OR dead_lettered_at IS NULL);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS arsy_deployment_outbox_available_v2_idx
  ON arsy_deployment_outbox (available_at, created_at)
  WHERE delivered_at IS NULL AND dead_lettered_at IS NULL;

COMMENT ON COLUMN arsy_deployment_outbox.lease_token IS
  'Unique fencing token for the current claim. A previous worker cannot ack after another claim replaces this token.';
COMMENT ON COLUMN arsy_deployment_outbox.max_attempts IS
  'Bounded delivery attempts before the event is terminally dead-lettered.';
COMMENT ON COLUMN arsy_deployment_outbox.dead_lettered_at IS
  'Terminal timestamp for an event that exceeded its attempt budget.';
