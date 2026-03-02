-- Migration: Fix devices table constraints
-- Problem: user_id is NOT NULL with FK to 'customers' table.
--          New architecture uses 'clients' table; every insert was failing.
-- Fix:
--   1. Drop the broken FK constraint on user_id
--   2. Make user_id nullable
--   3. Add client_id FK to clients table if column doesn't already exist
--   4. Add permissive RLS policies for device config tables

BEGIN;

-- 1. Drop the FK constraint that points user_id -> customers(id)
ALTER TABLE public.devices
    DROP CONSTRAINT IF EXISTS devices_owner_id_fkey,
    DROP CONSTRAINT IF EXISTS devices_user_id_fkey;

-- 2. Make user_id nullable
ALTER TABLE public.devices
    ALTER COLUMN user_id DROP NOT NULL;

-- 3. Add client_id column (FK to clients) if it doesn't exist
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- 4. RLS for device_config_tank
ALTER TABLE public.device_config_tank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_tank" ON public.device_config_tank;
CREATE POLICY "service_role_all_tank" ON public.device_config_tank
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_tank" ON public.device_config_tank;
CREATE POLICY "admin_all_tank" ON public.device_config_tank
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. RLS for device_config_deep
ALTER TABLE public.device_config_deep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_deep" ON public.device_config_deep;
CREATE POLICY "service_role_all_deep" ON public.device_config_deep
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_deep" ON public.device_config_deep;
CREATE POLICY "admin_all_deep" ON public.device_config_deep
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. RLS for device_config_flow
ALTER TABLE public.device_config_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_flow" ON public.device_config_flow;
CREATE POLICY "service_role_all_flow" ON public.device_config_flow
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_flow" ON public.device_config_flow;
CREATE POLICY "admin_all_flow" ON public.device_config_flow
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Ensure devices INSERT/SELECT/UPDATE work for authenticated users
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_can_insert_devices" ON public.devices;
CREATE POLICY "admin_can_insert_devices" ON public.devices
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_can_select_devices" ON public.devices;
CREATE POLICY "admin_can_select_devices" ON public.devices
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_can_update_devices" ON public.devices;
CREATE POLICY "admin_can_update_devices" ON public.devices
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_devices" ON public.devices;
CREATE POLICY "service_role_all_devices" ON public.devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

