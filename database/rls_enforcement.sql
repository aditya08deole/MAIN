-- RLS Enforcement & Security Policies (Self-Contained)
-- Target: Enable RLS and define authoritative access controls without external dependencies

BEGIN;

-- 1. Enable RLS on all core tables
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- 2. Define Authoritative Superadmin Policy
-- Use raw JWT metadata check to avoid dependency on get_user_role() function

-- REGIONS
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.regions;
CREATE POLICY "SuperAdmin Full Access" ON public.regions
    FOR ALL
    TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin')
    WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "Public Read Access" ON public.regions;
CREATE POLICY "Public Read Access" ON public.regions
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- COMMUNITIES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.communities;
CREATE POLICY "SuperAdmin Full Access" ON public.communities
    FOR ALL
    TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin')
    WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

DROP POLICY IF EXISTS "Public Read Access" ON public.communities;
CREATE POLICY "Public Read Access" ON public.communities
    FOR SELECT
    TO anon, authenticated
    USING (operational_status = 'active');

-- PROFILES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.profiles;
CREATE POLICY "SuperAdmin Full Access" ON public.profiles
    FOR ALL
    TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin')
    WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

-- DEVICES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.devices;
CREATE POLICY "SuperAdmin Full Access" ON public.devices
    FOR ALL
    TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin')
    WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

-- PIPELINES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.pipelines;
CREATE POLICY "SuperAdmin Full Access" ON public.pipelines
    FOR ALL
    TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin');

COMMIT;
