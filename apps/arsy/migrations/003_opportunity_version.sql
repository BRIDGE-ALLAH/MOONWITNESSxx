-- Add optimistic concurrency for opportunity edits without rewriting existing records.
ALTER TABLE arsy_opportunities
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arsy_opportunities_version_positive'
      AND conrelid = 'arsy_opportunities'::regclass
  ) THEN
    ALTER TABLE arsy_opportunities
      ADD CONSTRAINT arsy_opportunities_version_positive CHECK (version > 0);
  END IF;
END
$$;
