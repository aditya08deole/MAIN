-- Authoritative Schema Alignment Migration
-- Target: Align Supabase DB with Frontend Models and Intended Architecture

BEGIN;

-- 1. REGIONS Alignment
ALTER TABLE IF EXISTS public.regions 
  ADD COLUMN IF NOT EXISTS zone_code TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS regional_admin_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure constraints match expectations
ALTER TABLE public.regions ALTER COLUMN state DROP NOT NULL;
ALTER TABLE public.regions ALTER COLUMN country SET DEFAULT 'India';

-- 2. COMMUNITIES Alignment
ALTER TABLE IF EXISTS public.communities
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operational_status TEXT DEFAULT 'active';

-- Safety: Migrate contact_info JSONB data if it exists (very basic mapping)
-- UPDATE public.communities SET contact_person = contact_info->>'person' WHERE contact_info IS NOT NULL;
-- ALTER TABLE public.communities DROP COLUMN IF EXISTS contact_info;

-- 3. PROFILES Alignment
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 4. DEVICES Alignment
ALTER TABLE IF EXISTS public.devices
  RENAME COLUMN owner_id TO customer_id;

ALTER TABLE IF EXISTS public.devices
  ADD COLUMN IF NOT EXISTS asset_type TEXT,
  ADD COLUMN IF NOT EXISTS asset_category TEXT,
  ADD COLUMN IF NOT EXISTS physical_category TEXT,
  ADD COLUMN IF NOT EXISTS analytics_template TEXT,
  ADD COLUMN IF NOT EXISTS thingspeak_write_key TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Online',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 5. PIPELINES Creation
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pipeline_type TEXT,
    from_device_id UUID REFERENCES public.devices(id),
    to_device_id UUID REFERENCES public.devices(id),
    coordinates JSONB, -- [ [lat, long], ... ]
    diameter TEXT,
    material TEXT,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMIT;
