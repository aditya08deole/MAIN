-- ============================================================================
-- EVARATECH DATABASE OPTIMIZATION (Phase 1)
-- ============================================================================
-- Target: Normalize devices table and create telemetry snapshots for Realtime
-- ============================================================================

BEGIN;

-- 1. Create Telemetry Snapshots Table
CREATE TABLE public.device_telemetry_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE UNIQUE,
    metrics             JSONB NOT NULL DEFAULT '{}',
    thingspeak_entry_id BIGINT,
    telemetry_time      TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries by device
CREATE INDEX idx_telemetry_snapshots_device ON public.device_telemetry_snapshots(device_id);
CREATE INDEX idx_telemetry_snapshots_time ON public.device_telemetry_snapshots(telemetry_time);

-- 2. Alter Devices Table (Normalize & Add Configuration)
ALTER TABLE public.devices 
    DROP COLUMN IF EXISTS lat,
    DROP COLUMN IF EXISTS lng,
    DROP COLUMN IF EXISTS customer_id,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS physical_category;

ALTER TABLE public.devices 
    ADD COLUMN IF NOT EXISTS device_telemetry_config JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;

-- Migrate existing config into JSONB if needed (optional based on data state)
UPDATE public.devices 
SET device_telemetry_config = jsonb_build_object(
    'channel_id', thingspeak_channel_id,
    'read_key', thingspeak_read_key,
    'field_mapping', field_mapping
)
WHERE thingspeak_channel_id IS NOT NULL;

ALTER TABLE public.devices
    DROP COLUMN IF EXISTS thingspeak_channel_id,
    DROP COLUMN IF EXISTS thingspeak_read_key,
    DROP COLUMN IF EXISTS thingspeak_write_key,
    DROP COLUMN IF EXISTS field_mapping;

-- 3. Enable RLS on Snapshots
ALTER TABLE public.device_telemetry_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can select their own devices' snapshots
CREATE POLICY "snapshots_select_owner" ON public.device_telemetry_snapshots
    FOR SELECT TO authenticated
    USING (
        device_id IN (
            SELECT id FROM public.devices 
            WHERE user_id = auth.uid() OR public.get_user_role() = 'superadmin' OR (public.get_user_role() = 'distributor' AND community_id IN (SELECT community_id FROM public.profiles WHERE id = auth.uid()))
        )
    );

-- Policy: Superadmins can select all
CREATE POLICY "snapshots_select_superadmin" ON public.device_telemetry_snapshots
    FOR SELECT TO authenticated
    USING (public.get_user_role() = 'superadmin');

-- Note: Inserts to snapshots are handled by Service Role (FastAPI), bypassing these RLS checks for writing.

COMMIT;
