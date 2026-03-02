-- ============================================================================
-- EVARATECH DATABASE RESTRUCTURING (Phase 1)
-- ============================================================================
-- Target: Strict Zone -> Community -> Customer -> Device Hierarchy + Clean RLS
-- ============================================================================

BEGIN;

-- 1. Rename regions to zones
ALTER TABLE public.regions RENAME TO zones;
ALTER TABLE public.zones RENAME CONSTRAINT regions_pkey TO zones_pkey;
ALTER TABLE public.zones RENAME CONSTRAINT regions_name_key TO zones_name_key;

-- 2. Refactor Communities to use zone_id and enforce cascading
ALTER TABLE public.communities RENAME COLUMN region_id TO zone_id;

-- Drop old foreign key if it uses the standard naming, or just add the new one. 
-- Since we don't know the exact old constraint name, we assume it'll be fine or we do it via a DO block.
DO $$ 
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.key_column_usage
  WHERE table_name = 'communities' AND column_name = 'zone_id' AND position_in_unique_constraint IS NOT NULL;
  
  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.communities DROP CONSTRAINT ' || fk_name;
  END IF;
END $$;

ALTER TABLE public.communities 
  ALTER COLUMN zone_id SET NOT NULL,
  ADD CONSTRAINT communities_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


-- 3. Profiles (Customers) enforce strict FK and cascading to communities
DO $$ 
DECLARE
  fk_name text;
BEGIN
  SELECT constraint_name INTO fk_name
  FROM information_schema.key_column_usage
  WHERE table_name = 'profiles' AND column_name = 'community_id' AND position_in_unique_constraint IS NOT NULL;
  
  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || fk_name;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_customer_community_check,
  ADD CONSTRAINT profiles_customer_community_check 
  CHECK (role != 'customer' OR community_id IS NOT NULL);


-- 4. Clean up Devices (Ensure Leaf Node is strictly tied to user_id)
-- If customer_id exists legacy, rename it to user_id.
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='customer_id') THEN
    ALTER TABLE public.devices RENAME COLUMN customer_id TO user_id;
  END IF;
END $$;

ALTER TABLE public.devices
  ALTER COLUMN user_id SET NOT NULL;

-- Remove duplicate hierarchy / unstructured fields
ALTER TABLE public.devices
  DROP COLUMN IF EXISTS community_id CASCADE,
  DROP COLUMN IF EXISTS lat CASCADE,
  DROP COLUMN IF EXISTS lng CASCADE,
  DROP COLUMN IF EXISTS category CASCADE,
  DROP COLUMN IF EXISTS physical_category CASCADE,
  DROP COLUMN IF EXISTS asset_category CASCADE; -- Often duplicates asset_type

-- Ensure defaults
ALTER TABLE public.zones ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.communities ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.devices ALTER COLUMN id SET DEFAULT gen_random_uuid();


-- 5. Indexes for hierarchy performance
DROP INDEX IF EXISTS idx_regions_name;
DROP INDEX IF EXISTS idx_regions_zone_code;
DROP INDEX IF EXISTS idx_regions_is_active;
CREATE INDEX IF NOT EXISTS idx_zones_name ON public.zones(name);
CREATE INDEX IF NOT EXISTS idx_zones_zone_code ON public.zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_zones_is_active ON public.zones(is_active);

DROP INDEX IF EXISTS idx_communities_region_id;
CREATE INDEX IF NOT EXISTS idx_communities_zone_id ON public.communities(zone_id);

CREATE INDEX IF NOT EXISTS idx_profiles_community_id ON public.profiles(community_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_asset_type ON public.devices(asset_type);


-- 6. Strict Row-Level Security Policies
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Wipe existing loose policies to prevent conflict
DROP POLICY IF EXISTS "zones_superadmin_all" ON public.zones;
DROP POLICY IF EXISTS "zones_customer_read" ON public.zones;
DROP POLICY IF EXISTS "Enable all actions for superadmins" ON public.zones;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.zones;

DROP POLICY IF EXISTS "communities_superadmin_all" ON public.communities;
DROP POLICY IF EXISTS "communities_customer_read" ON public.communities;
DROP POLICY IF EXISTS "Enable all actions for superadmins" ON public.communities;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.communities;

DROP POLICY IF EXISTS "devices_superadmin_all" ON public.devices;
DROP POLICY IF EXISTS "devices_owner_all" ON public.devices;
DROP POLICY IF EXISTS "Enable all actions for superadmins" ON public.devices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.devices;


-- Build new precise policies
-- ZONES
CREATE POLICY "zones_superadmin_all" ON public.zones
    FOR ALL TO authenticated USING (public.get_user_role() = 'superadmin');

CREATE POLICY "zones_customer_read" ON public.zones
    FOR SELECT TO authenticated 
    USING (
      id IN (
        SELECT zone_id FROM public.communities WHERE id = (
          SELECT community_id FROM public.profiles WHERE id = auth.uid()
        )
      )
    );

-- COMMUNITIES
CREATE POLICY "communities_superadmin_all" ON public.communities
    FOR ALL TO authenticated USING (public.get_user_role() = 'superadmin');

CREATE POLICY "communities_customer_read" ON public.communities
    FOR SELECT TO authenticated 
    USING (
      id = (SELECT community_id FROM public.profiles WHERE id = auth.uid())
    );

-- DEVICES
CREATE POLICY "devices_superadmin_all" ON public.devices
    FOR ALL TO authenticated USING (public.get_user_role() = 'superadmin');

CREATE POLICY "devices_owner_all" ON public.devices
    FOR ALL TO authenticated 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


COMMIT;
