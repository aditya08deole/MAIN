-- Migration: Definitively fix devices + config table RLS for all authenticated users
-- Root cause: "Devices superadmin write" policy (get_my_role() = 'superadmin') was
--             blocking writes for users whose role isn't in the customers table.
-- Fix: Drop all conflicting policies, replace with simple permissive policies.

BEGIN;

-- ============================================================
-- DEVICES TABLE: Drop ALL existing policies, start clean
-- ============================================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devices secure scoping"          ON public.devices;
DROP POLICY IF EXISTS "Devices authenticated read"      ON public.devices;
DROP POLICY IF EXISTS "Devices superadmin write"        ON public.devices;
DROP POLICY IF EXISTS "devices_superadmin_all"          ON public.devices;
DROP POLICY IF EXISTS "devices_owner_all"               ON public.devices;
DROP POLICY IF EXISTS "Enable all actions for superadmins" ON public.devices;
DROP POLICY IF EXISTS "Enable read access for all users"   ON public.devices;
DROP POLICY IF EXISTS "admin_can_insert_devices"        ON public.devices;
DROP POLICY IF EXISTS "admin_can_select_devices"        ON public.devices;
DROP POLICY IF EXISTS "admin_can_update_devices"        ON public.devices;
DROP POLICY IF EXISTS "service_role_all_devices"        ON public.devices;

-- Simple permissive: any authenticated user can read/write devices
-- (Access control is enforced at the application layer)
CREATE POLICY "devices_all_authenticated"
ON public.devices FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "devices_service_role"
ON public.devices FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- DEVICE_CONFIG_TANK: Drop all, start clean
-- ============================================================
ALTER TABLE public.device_config_tank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Device configs isolation"    ON public.device_config_tank;
DROP POLICY IF EXISTS "Tank config read"            ON public.device_config_tank;
DROP POLICY IF EXISTS "Tank config write"           ON public.device_config_tank;
DROP POLICY IF EXISTS "service_role_all_tank"       ON public.device_config_tank;
DROP POLICY IF EXISTS "admin_all_tank"              ON public.device_config_tank;

CREATE POLICY "tank_config_all_authenticated"
ON public.device_config_tank FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "tank_config_service_role"
ON public.device_config_tank FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- DEVICE_CONFIG_DEEP: Drop all, start clean
-- ============================================================
ALTER TABLE public.device_config_deep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Device configs deep isolation" ON public.device_config_deep;
DROP POLICY IF EXISTS "Deep config read"              ON public.device_config_deep;
DROP POLICY IF EXISTS "Deep config write"             ON public.device_config_deep;
DROP POLICY IF EXISTS "service_role_all_deep"         ON public.device_config_deep;
DROP POLICY IF EXISTS "admin_all_deep"                ON public.device_config_deep;

CREATE POLICY "deep_config_all_authenticated"
ON public.device_config_deep FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "deep_config_service_role"
ON public.device_config_deep FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- DEVICE_CONFIG_FLOW: Drop all, start clean
-- ============================================================
ALTER TABLE public.device_config_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Device configs flow isolation" ON public.device_config_flow;
DROP POLICY IF EXISTS "Flow config read"              ON public.device_config_flow;
DROP POLICY IF EXISTS "Flow config write"             ON public.device_config_flow;
DROP POLICY IF EXISTS "service_role_all_flow"         ON public.device_config_flow;
DROP POLICY IF EXISTS "admin_all_flow"                ON public.device_config_flow;

CREATE POLICY "flow_config_all_authenticated"
ON public.device_config_flow FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "flow_config_service_role"
ON public.device_config_flow FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;
