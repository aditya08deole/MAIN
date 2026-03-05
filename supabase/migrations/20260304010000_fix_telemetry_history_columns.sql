-- Also fix the legacy 'metrics' NOT NULL constraint — the new typed columns replace it
ALTER TABLE public.telemetry_history ALTER COLUMN metrics DROP NOT NULL;
ALTER TABLE public.telemetry_history ALTER COLUMN metrics SET DEFAULT '{}'::jsonb;

-- =============================================================================
-- Migration: Fix telemetry_history schema
-- Adds the typed columns that the backend ingestion service expects.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
-- =============================================================================

-- Drop old constraints that reference the removed 'devices' table
ALTER TABLE public.telemetry_history
    DROP CONSTRAINT IF EXISTS telemetry_history_device_id_fkey;

-- Add missing columns (all optional, no data loss on existing rows)
ALTER TABLE public.telemetry_history
    ADD COLUMN IF NOT EXISTS thingspeak_entry_id  INTEGER,
    ADD COLUMN IF NOT EXISTS device_type          TEXT
        CHECK (device_type IS NULL OR device_type IN ('EvaraTank','EvaraFlow','EvaraDeep')),
    ADD COLUMN IF NOT EXISTS field1               FLOAT,
    ADD COLUMN IF NOT EXISTS field2               FLOAT,
    ADD COLUMN IF NOT EXISTS field3               FLOAT,
    ADD COLUMN IF NOT EXISTS field4               FLOAT,
    ADD COLUMN IF NOT EXISTS field5               FLOAT,
    ADD COLUMN IF NOT EXISTS field6               FLOAT,
    ADD COLUMN IF NOT EXISTS field7               FLOAT,
    ADD COLUMN IF NOT EXISTS field8               FLOAT,
    ADD COLUMN IF NOT EXISTS level_percentage     FLOAT,
    ADD COLUMN IF NOT EXISTS depth_value          FLOAT,
    ADD COLUMN IF NOT EXISTS temperature_value    FLOAT,
    ADD COLUMN IF NOT EXISTS flow_rate            FLOAT,
    ADD COLUMN IF NOT EXISTS total_liters         BIGINT,
    ADD COLUMN IF NOT EXISTS ingested_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Rename the old 'metrics' JSONB column if it exists (keep it for backward compat)
-- ALTER TABLE public.telemetry_history RENAME COLUMN metrics TO metrics_legacy;
-- ^ Commented out: leave legacy column untouched to avoid breaking old queries.

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_history_device_ts
    ON public.telemetry_history (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_history_entry_id
    ON public.telemetry_history (device_id, thingspeak_entry_id);

-- Unique: don't store the same ThingSpeak entry twice per device
CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_history_device_entry
    ON public.telemetry_history (device_id, thingspeak_entry_id)
    WHERE thingspeak_entry_id IS NOT NULL;

-- RLS: allow backend service role to insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='telemetry_history' AND policyname='service_write_history') THEN
    CREATE POLICY "service_write_history" ON public.telemetry_history
        FOR INSERT WITH CHECK (true);
  END IF;
END $$;
