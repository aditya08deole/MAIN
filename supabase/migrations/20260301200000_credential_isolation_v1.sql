-- Migration: Phase 1 - Credential Isolation
-- Description: Moves ThingSpeak credentials from generic JSONB to specialized config tables.

BEGIN;

-- 1. Add credential columns to specialized config tables
ALTER TABLE public.device_config_tank 
    ADD COLUMN IF NOT EXISTS thingspeak_channel_id TEXT,
    ADD COLUMN IF NOT EXISTS thingspeak_read_key TEXT;

ALTER TABLE public.device_config_flow 
    ADD COLUMN IF NOT EXISTS thingspeak_channel_id TEXT,
    ADD COLUMN IF NOT EXISTS thingspeak_read_key TEXT;

ALTER TABLE public.device_config_deep 
    ADD COLUMN IF NOT EXISTS thingspeak_channel_id TEXT,
    ADD COLUMN IF NOT EXISTS thingspeak_read_key TEXT;

-- 2. Data Migration: Move existing credentials from devices.device_telemetry_config
-- Guarded: only runs if the source column exists (safe for remotes where it was never added)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'device_telemetry_config'
    ) THEN
        -- For Tanks
        UPDATE public.device_config_tank config
        SET
            thingspeak_channel_id = (d.device_telemetry_config->>'channel_id'),
            thingspeak_read_key   = (d.device_telemetry_config->>'read_key')
        FROM public.devices d
        WHERE config.device_id = d.id
          AND d.device_telemetry_config ? 'channel_id';

        -- For Flow
        UPDATE public.device_config_flow config
        SET
            thingspeak_channel_id = (d.device_telemetry_config->>'channel_id'),
            thingspeak_read_key   = (d.device_telemetry_config->>'read_key')
        FROM public.devices d
        WHERE config.device_id = d.id
          AND d.device_telemetry_config ? 'channel_id';

        -- For Deep Wells
        UPDATE public.device_config_deep config
        SET
            thingspeak_channel_id = (d.device_telemetry_config->>'channel_id'),
            thingspeak_read_key   = (d.device_telemetry_config->>'read_key')
        FROM public.devices d
        WHERE config.device_id = d.id
          AND d.device_telemetry_config ? 'channel_id';
    ELSE
        RAISE NOTICE 'device_telemetry_config column not found on devices — skipping data migration (already clean).';
    END IF;
END $$;

-- 3. Security: In Reality, we would eventually drop thingspeak_read_key from devices table
-- but we keep it for now until backend mappers are fully updated in Phase 3.

COMMIT;
