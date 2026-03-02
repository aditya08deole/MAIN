-- Migration: Fix Profiles Schema & Auth Sync
-- Phase 3.1 Repair

-- 1. Add distributor_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES public.distributors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_distributor_id ON public.profiles(distributor_id);

-- 2. Update Auth Metadata Sync (Corrected Column Names)
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        coalesce(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'distributor_id', NEW.distributor_id,
            'community_id', NEW.community_id,
            'role', NEW.role
        )
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_to_auth_metadata ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_auth_metadata
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_auth_metadata();

-- 3. Initial sync
UPDATE auth.users u
SET raw_app_meta_data = 
    coalesce(u.raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'distributor_id', p.distributor_id,
        'community_id', p.community_id,
        'role', p.role
    )
FROM public.profiles p
WHERE u.id = p.id;
