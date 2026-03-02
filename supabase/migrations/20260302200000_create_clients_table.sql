-- Migration: Create proper `clients` table for hierarchy customers
-- The `customers` table remains as the Supabase Auth profile table (superadmins/staff)
-- `clients` is the new table for actual water utility subscribers in the hierarchy
-- Hierarchy: zones → communities → clients → devices

-- ============================================================
-- 1. CREATE CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    is_active   BOOLEAN DEFAULT true,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_community_id ON public.clients(community_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_active    ON public.clients(is_active) WHERE is_active = true;

-- ============================================================
-- 2. ADD client_id FK TO DEVICES
-- ============================================================
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_client_id ON public.devices(client_id);

-- ============================================================
-- 3. RLS FOR CLIENTS
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients authenticated read"
ON public.clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Clients superadmin write"
ON public.clients FOR ALL
TO authenticated
USING (public.get_my_role() = 'superadmin')
WITH CHECK (public.get_my_role() = 'superadmin');

-- ============================================================
-- 4. updated_at TRIGGER FOR CLIENTS
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_clients_updated_at'
    ) THEN
        CREATE TRIGGER set_clients_updated_at
        BEFORE UPDATE ON public.clients
        FOR EACH ROW
        EXECUTE FUNCTION public.set_current_timestamp_updated_at();
    END IF;
END $$;

-- ============================================================
-- 5. VIEW: client_hierarchy_v1
--    Joins clients → communities → zones for easy frontend queries
-- ============================================================
DROP VIEW IF EXISTS public.client_hierarchy;
CREATE VIEW public.client_hierarchy AS
SELECT
    cl.id,
    cl.name,
    cl.email,
    cl.phone,
    cl.address,
    cl.is_active,
    cl.notes,
    cl.created_at,
    com.id   AS community_id,
    com.name AS community_name,
    z.id     AS zone_id,
    z.name   AS zone_name,
    z.state  AS zone_state,
    (SELECT COUNT(*) FROM public.devices d WHERE d.client_id = cl.id) AS device_count
FROM public.clients cl
LEFT JOIN public.communities com ON cl.community_id = com.id
LEFT JOIN public.zones z ON com.zone_id = z.id;

COMMENT ON TABLE public.clients IS 'Water utility subscribers. Part of hierarchy: zones → communities → clients → devices.';
