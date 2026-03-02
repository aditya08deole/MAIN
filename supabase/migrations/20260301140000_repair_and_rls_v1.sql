-- Migration: Repair Hierarchy & Hardened RLS (JWT-centric)
-- Phase 3 of EvaraTech SaaS Evolution

-- 1. Repair missing hierarchy link in devices
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_devices_community_id ON public.devices(community_id);

-- 2. Enable RLS on all relevant tables
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_config_tank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_config_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_config_deep ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_snapshots ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies on core tables to prevent conflicts
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.devices;
DROP POLICY IF EXISTS "Enable read for owners" ON public.devices;
DROP POLICY IF EXISTS "Superadmin bypass" ON public.devices;
DROP POLICY IF EXISTS "Devices secure scoping" ON public.devices;

-- 4. DISTRIBUTORS POLICY (Tenancy Isolation)
CREATE POLICY "Superadmin manage all distributors"
ON public.distributors
FOR ALL
TO authenticated
USING ( (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'superadmin' );

CREATE POLICY "Distributor admin manage own"
ON public.distributors
FOR ALL
TO authenticated
USING ( id = (auth.jwt() -> 'app_metadata' ->> 'distributor_id')::uuid );

-- 5. ZONES & COMMUNITIES (Tenancy Scoping)
DROP POLICY IF EXISTS "Zones multi-tenant isolation" ON public.zones;
CREATE POLICY "Zones multi-tenant isolation"
ON public.zones
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'superadmin' OR
    distributor_id = (auth.jwt() -> 'app_metadata' ->> 'distributor_id')::uuid
);

DROP POLICY IF EXISTS "Communities multi-tenant isolation" ON public.communities;
CREATE POLICY "Communities multi-tenant isolation"
ON public.communities
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'superadmin' OR
    zone_id IN (SELECT id FROM public.zones WHERE distributor_id = (auth.jwt() -> 'app_metadata' ->> 'distributor_id')::uuid)
);

-- 6. DEVICES (Secure Scoping)
CREATE POLICY "Devices secure scoping"
ON public.devices
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'superadmin' OR
    user_id = auth.uid() OR
    community_id IN (
        SELECT id FROM public.communities WHERE zone_id IN (
            SELECT id FROM public.zones WHERE distributor_id = (auth.jwt() -> 'app_metadata' ->> 'distributor_id')::uuid
        )
    )
);

-- 7. CONFIG TABLES (Strict 1:1 Matching)
DROP POLICY IF EXISTS "Device configs isolation" ON public.device_config_tank;
CREATE POLICY "Device configs isolation"
ON public.device_config_tank FOR SELECT TO authenticated USING (device_id IN (SELECT id FROM public.devices));

DROP POLICY IF EXISTS "Device configs flow isolation" ON public.device_config_flow;
CREATE POLICY "Device configs flow isolation"
ON public.device_config_flow FOR SELECT TO authenticated USING (device_id IN (SELECT id FROM public.devices));

DROP POLICY IF EXISTS "Device configs deep isolation" ON public.device_config_deep;
CREATE POLICY "Device configs deep isolation"
ON public.device_config_deep FOR SELECT TO authenticated USING (device_id IN (SELECT id FROM public.devices));

-- 8. TELEMETRY SNAPSHOTS (UI Realtime Source)
DROP POLICY IF EXISTS "Telemetry snapshots isolation" ON public.telemetry_snapshots;
CREATE POLICY "Telemetry snapshots isolation"
ON public.telemetry_snapshots
FOR SELECT
TO authenticated
USING (device_id IN (SELECT id FROM public.devices));

-- 9. SERVICE ROLE BYPASS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
