-- RLS Refinement V2: Profile-Based Authorization
-- Target: Robust security that doesn't rely solely on JWT metadata

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES - Foundation for others
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "SuperAdmin Full Access" ON public.profiles
    FOR ALL TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    );

-- 3. REGIONS
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.regions;
DROP POLICY IF EXISTS "Public Read Access" ON public.regions;

CREATE POLICY "SuperAdmin Full Access" ON public.regions
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    );

CREATE POLICY "Public Read Access" ON public.regions
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- 4. COMMUNITIES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.communities;
DROP POLICY IF EXISTS "Public Read Access" ON public.communities;

CREATE POLICY "SuperAdmin Full Access" ON public.communities
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    );

CREATE POLICY "Public Read Access" ON public.communities
    FOR SELECT TO anon, authenticated
    USING (operational_status = 'active');

-- 5. DEVICES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.devices;
CREATE POLICY "SuperAdmin Full Access" ON public.devices
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    );

-- 6. PIPELINES
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.pipelines;
CREATE POLICY "SuperAdmin Full Access" ON public.pipelines
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin'
    );

COMMIT;
