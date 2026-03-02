-- RLS Emergency Permissive Mode (DEBUG)
-- Target: Broaden SELECT access to confirm if RLS is the visibility bottleneck

BEGIN;

-- 1. Ensure RLS is enabled (stay secure for write)
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Broaden SELECT for Regions
DROP POLICY IF EXISTS "Public Read Access" ON public.regions;
CREATE POLICY "Public Read Access" ON public.regions
    FOR SELECT TO anon, authenticated
    USING (true); -- Allow all to read regions for now

-- 3. Broaden SELECT for Communities
DROP POLICY IF EXISTS "Public Read Access" ON public.communities;
CREATE POLICY "Public Read Access" ON public.communities
    FOR SELECT TO anon, authenticated
    USING (true); -- Allow all to read communities for now

-- 4. Broaden SELECT for Devices
DROP POLICY IF EXISTS "Public Read Access" ON public.devices;
CREATE POLICY "Public Read Access" ON public.devices
    FOR SELECT TO anon, authenticated
    USING (true);

-- 5. Broaden SELECT for Pipelines
DROP POLICY IF EXISTS "Public Read Access" ON public.pipelines;
CREATE POLICY "Public Read Access" ON public.pipelines
    FOR SELECT TO anon, authenticated
    USING (true);

-- 6. Broaden SELECT for Profiles (Partial)
-- Allow authenticated users to see other profiles so they can verify roles
DROP POLICY IF EXISTS "SuperAdmin Full Access" ON public.profiles;
CREATE POLICY "SuperAdmin Full Access" ON public.profiles
    FOR ALL TO authenticated
    USING (true); -- Broad read/write for profiles in debug mode

COMMIT;
