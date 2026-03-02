-- Migration: Phase 1 - Typed Telemetry & ENUMs
-- Description: Adds strongly-typed columns to telemetry_snapshots and creates standard ENUMs.

BEGIN;

-- 1. Create ENUMs for strict categorization
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_category') THEN
        CREATE TYPE public.device_category AS ENUM ('EvaraTank', 'EvaraDeep', 'EvaraFlow');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'node_asset_type') THEN
        CREATE TYPE public.node_asset_type AS ENUM ('tank', 'sump', 'borewell', 'well', 'flow_meter');
    END IF;
END $$;

-- 2. Add typed columns to telemetry_snapshots
ALTER TABLE public.telemetry_snapshots 
    ADD COLUMN IF NOT EXISTS level_percentage FLOAT,
    ADD COLUMN IF NOT EXISTS depth_value FLOAT,
    ADD COLUMN IF NOT EXISTS temperature_value FLOAT,
    ADD COLUMN IF NOT EXISTS flow_rate FLOAT,
    ADD COLUMN IF NOT EXISTS total_liters BIGINT;

-- 3. Add indices for performance on typed columns
CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_level ON public.telemetry_snapshots(level_percentage);
CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_flow ON public.telemetry_snapshots(flow_rate);

-- 4. Clean up generic fields if they conflict with future strict typing
-- (Optional: only if we want to enforce zero-JSON usage later)
-- COMMENT ON COLUMN public.telemetry_snapshots.mapped_values IS 'Legacy JSON mapping; transition to typed columns preferred.';

COMMIT;
