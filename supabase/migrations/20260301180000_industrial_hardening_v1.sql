-- Migration: Industrial Hardening (Indexes & Data Types)
-- Phase 6 of EvaraTech SaaS Evolution

-- 1. Ensure B-Tree Indexes on all Foreign Keys
CREATE INDEX IF NOT EXISTS idx_distributors_plan_id ON public.distributors(plan_id);
CREATE INDEX IF NOT EXISTS idx_zones_distributor_id ON public.zones(distributor_id);
CREATE INDEX IF NOT EXISTS idx_communities_zone_id ON public.communities(zone_id);
CREATE INDEX IF NOT EXISTS idx_profiles_community_id ON public.profiles(community_id);
CREATE INDEX IF NOT EXISTS idx_profiles_distributor_id ON public.profiles(distributor_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_community_id ON public.devices(community_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_distributor_id ON public.audit_logs(distributor_id);

-- 2. Telemetry Snapshots Hardening
CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_device_id ON public.telemetry_snapshots(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_last_timestamp ON public.telemetry_snapshots(last_timestamp DESC);

-- 4. Constraint Hardening
ALTER TABLE public.devices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.devices ALTER COLUMN node_key SET NOT NULL;
-- Use label if name is missing
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'label') THEN
        ALTER TABLE public.devices ALTER COLUMN label SET NOT NULL;
    END IF;
END $$;

DROP INDEX IF EXISTS unique_node_key;
CREATE UNIQUE INDEX unique_node_key ON public.devices(node_key);

-- 5. Performance Views for Hierarchy
CREATE OR REPLACE VIEW public.vw_device_hierarchy AS
SELECT 
    d.id AS device_id,
    d.label AS device_name,
    d.node_key,
    c.name AS community_name,
    z.name AS zone_name,
    dist.name AS distributor_name,
    dist.id AS distributor_id
FROM public.devices d
LEFT JOIN public.communities c ON d.community_id = c.id
LEFT JOIN public.zones z ON c.zone_id = z.id
LEFT JOIN public.distributors dist ON z.distributor_id = dist.id
WHERE d.deleted_at IS NULL;

-- Enable RLS on view
ALTER VIEW public.vw_device_hierarchy SET (security_invoker = on);
