-- Apply through deployment/System Mode; application startup must not mutate schema.
-- Evidence history is append-only even for direct SQL clients, not merely by API convention.
CREATE OR REPLACE FUNCTION reject_arsy_evidence_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'arsy_evidence_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS arsy_evidence_events_reject_row_mutation ON arsy_evidence_events;
CREATE TRIGGER arsy_evidence_events_reject_row_mutation
  BEFORE UPDATE OR DELETE ON arsy_evidence_events
  FOR EACH ROW
  EXECUTE FUNCTION reject_arsy_evidence_event_mutation();

DROP TRIGGER IF EXISTS arsy_evidence_events_reject_truncate ON arsy_evidence_events;
CREATE TRIGGER arsy_evidence_events_reject_truncate
  BEFORE TRUNCATE ON arsy_evidence_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION reject_arsy_evidence_event_mutation();
