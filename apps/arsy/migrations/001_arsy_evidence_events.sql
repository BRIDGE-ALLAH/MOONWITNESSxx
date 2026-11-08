-- Apply through deployment/System Mode; application startup must not mutate schema.
CREATE TABLE IF NOT EXISTS arsy_evidence_events (
  aggregate_id text NOT NULL,
  stream_position bigint NOT NULL,
  id text NOT NULL,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL,
  actor_id text NOT NULL,
  payload jsonb NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_hash text,
  event_hash char(64) NOT NULL,
  PRIMARY KEY (aggregate_id, stream_position),
  UNIQUE (aggregate_id, id)
);

CREATE INDEX IF NOT EXISTS arsy_evidence_events_recorded_at_idx
  ON arsy_evidence_events (aggregate_id, recorded_at, stream_position);

COMMENT ON TABLE arsy_evidence_events IS
  'Append-only ARSY evidence event streams. Hash chain integrity is not source authenticity.';
