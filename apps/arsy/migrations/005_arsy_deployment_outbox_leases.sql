-- Lease fencing and bounded retry lifecycle for the ARSY transactional outbox.
-- Apply through the reviewed migration process; never at application startup.
ALTER TABLE arsy_deployment_outbox
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

-- Preserve any pre-existing in-flight claim while upgrading older rows.
UPDATE arsy_deployment_outbox
SET lease_token = gen_random_uuid()
WHERE locked_by IS NOT NULL AND lease_token IS NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'arsy_deployment_outbox_max_attempts_check'
      AND conrelid = 'arsy_deployment_outbox'::regclass
  ) THEN
    ALTER TABLE arsy_deployment_outbox
      ADD CONSTRAINT arsy_deployment_outbox_max_attempts_check
      CHECK (max_attempts BETWEEN 1 AND 20);
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
    WHERE conname = 'arsy_deployment_outbox_dead_letter_check'
      AND conrelid = 'arsy_deployment_outbox'::regclass
  ) THEN
    ALTER TABLE arsy_deployment_outbox
      ADD CONSTRAINT arsy_deployment_outbox_dead_letter_check
      CHECK (dead_lettered_at IS NULL OR delivered_at IS NULL);
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS arsy_deployment_outbox_ready_idx
  ON arsy_deployment_outbox (available_at, created_at, id)
  WHERE delivered_at IS NULL AND dead_lettered_at IS NULL;

CREATE INDEX IF NOT EXISTS arsy_deployment_outbox_lease_expiry_idx
  ON arsy_deployment_outbox (locked_until)
  WHERE delivered_at IS NULL AND dead_lettered_at IS NULL AND locked_until IS NOT NULL;

COMMENT ON COLUMN arsy_deployment_outbox.lease_token IS
  'Unpredictable per-claim fencing token. A worker may ack/retry only with the current unexpired token.';
COMMENT ON COLUMN arsy_deployment_outbox.max_attempts IS
  'Maximum number of claims before the event is permanently dead-lettered; bounded to 1..20.';
COMMENT ON COLUMN arsy_deployment_outbox.dead_lettered_at IS
  'Terminal timestamp for an event that exhausted its configured claim attempts.';
