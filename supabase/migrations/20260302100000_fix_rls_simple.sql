-- Migration: Fix RLS Policies - Simple Permissive for Development
-- Root cause: Previous policies checked app_metadata.role which is NEVER set by Supabase
-- by default. Only service_role can write app_metadata. We now use user_metadata OR
-- a direct lookup in the customers table for the role check.
-- Security hardening (distributor isolation, RBAC) will be added in a future migration.

-- ============================================================
-- HELPER FUNCTION: Get the current user's role from customers table
-- SECURITY DEFINER so it bypasses RLS on customers table itself
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.customers WHERE id = auth.uid() LIMIT 1),
    (auth.jwt() ->> 'role'),
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'customer'
  );
$$;

-- ============================================================
-- ZONES
-- ============================================================
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Zones multi-tenant isolation" ON public.zones;
DROP POLICY IF EXISTS "Zones public read" ON public.zones;
DROP POLICY IF EXISTS "Zones authenticated read" ON public.zones;
DROP POLICY IF EXISTS "Zones superadmin write" ON public.zones;

-- All authenticated users can read zones (superadmin sees all, others see all for now)
CREATE POLICY "Zones authenticated read"
ON public.zones FOR SELECT
TO authenticated
USING (true);

-- Only superadmin can insert/update/delete zones
CREATE POLICY "Zones superadmin write"
ON public.zones FOR ALL
TO authenticated
USING (public.get_my_role() = 'superadmin')
WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- COMMUNITIES
-- ============================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Communities multi-tenant isolation" ON public.communities;
DROP POLICY IF EXISTS "Communities authenticated read" ON public.communities;
DROP POLICY IF EXISTS "Communities superadmin write" ON public.communities;

CREATE POLICY "Communities authenticated read"
ON public.communities FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Communities superadmin write"
ON public.communities FOR ALL
TO authenticated
USING (public.get_my_role() = 'superadmin')
WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- CUSTOMERS
-- ============================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers superadmin all" ON public.customers;
DROP POLICY IF EXISTS "Customers authenticated read" ON public.customers;

-- Users can always read their own row (needed for auth profile lookup)
CREATE POLICY "Customers read own profile"
ON public.customers FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.get_my_role() = 'superadmin');

-- Users can update only their own profile
CREATE POLICY "Customers update own profile"
ON public.customers FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.get_my_role() = 'superadmin')
WITH CHECK (id = auth.uid() OR public.get_my_role() = 'superadmin');

-- Superadmin can insert / delete
CREATE POLICY "Customers superadmin insert"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (public.get_my_role() = 'superadmin' OR id = auth.uid());

CREATE POLICY "Customers superadmin delete"
ON public.customers FOR DELETE
TO authenticated
USING (public.get_my_role() = 'superadmin');

-- ============================================================
-- DEVICES
-- ============================================================
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devices secure scoping" ON public.devices;
DROP POLICY IF EXISTS "Devices authenticated read" ON public.devices;
DROP POLICY IF EXISTS "Devices superadmin write" ON public.devices;

CREATE POLICY "Devices authenticated read"
ON public.devices FOR SELECT
TO authenticated
USING (
    public.get_my_role() = 'superadmin'
    OR user_id = auth.uid()
    OR community_id IN (
        SELECT id FROM public.communities
        WHERE zone_id IN (
            SELECT id FROM public.zones WHERE is_active = true
        )
    )
);

CREATE POLICY "Devices superadmin write"
ON public.devices FOR ALL
TO authenticated
USING (public.get_my_role() = 'superadmin')
WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- DEVICE CONFIG TABLES
-- ============================================================
ALTER TABLE public.device_config_tank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_config_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_config_deep ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Device configs isolation" ON public.device_config_tank;
DROP POLICY IF EXISTS "Device configs flow isolation" ON public.device_config_flow;
DROP POLICY IF EXISTS "Device configs deep isolation" ON public.device_config_deep;

CREATE POLICY "Tank config read"
ON public.device_config_tank FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tank config write"
ON public.device_config_tank FOR ALL TO authenticated
USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "Flow config read"
ON public.device_config_flow FOR SELECT TO authenticated USING (true);
CREATE POLICY "Flow config write"
ON public.device_config_flow FOR ALL TO authenticated
USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');

CREATE POLICY "Deep config read"
ON public.device_config_deep FOR SELECT TO authenticated USING (true);
CREATE POLICY "Deep config write"
ON public.device_config_deep FOR ALL TO authenticated
USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- DISTRIBUTORS
-- ============================================================
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin manage all distributors" ON public.distributors;
DROP POLICY IF EXISTS "Distributor admin manage own" ON public.distributors;

CREATE POLICY "Distributors read"
ON public.distributors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Distributors superadmin write"
ON public.distributors FOR ALL TO authenticated
USING (public.get_my_role() = 'superadmin') WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- TELEMETRY SNAPSHOTS
-- ============================================================
ALTER TABLE public.telemetry_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Telemetry read own" ON public.telemetry_snapshots;
DROP POLICY IF EXISTS "Telemetry authenticated read" ON public.telemetry_snapshots;

CREATE POLICY "Telemetry authenticated read"
ON public.telemetry_snapshots FOR SELECT
TO authenticated
USING (
    public.get_my_role() = 'superadmin'
    OR device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())
);

CREATE POLICY "Telemetry insert"
ON public.telemetry_snapshots FOR INSERT
TO authenticated
WITH CHECK (true);  -- Backend service inserts telemetry

-- ============================================================
-- AUDIT LOGS
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit logs superadmin read" ON public.audit_logs;

CREATE POLICY "Audit logs superadmin read"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.get_my_role() = 'superadmin');

CREATE POLICY "Audit logs insert"
ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- SUPERADMIN SETUP: Ensure the first super admin user has correct role
-- This is idempotent - safe to run multiple times
-- ============================================================
-- NOTE: After running this migration, you must update the first user's role
-- in the customers table: UPDATE customers SET role = 'superadmin' WHERE email = 'your@email.com';
