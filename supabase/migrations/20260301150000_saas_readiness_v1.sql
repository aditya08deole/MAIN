-- Migration: SaaS Readiness (Soft Deletes, Plan Enforcement, Auditing)
-- Phase 4 of EvaraTech SaaS Evolution

-- 1. Seeding Base Plans
INSERT INTO public.plans (name, max_devices, retention_days)
VALUES 
    ('Trial', 3, 7),
    ('Standard', 50, 90),
    ('Enterprise', 1000, 365)
ON CONFLICT (name) DO NOTHING;

-- 2. Audit Logs Enhancement
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES public.distributors(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_distributor_id ON public.audit_logs(distributor_id);

-- 3. Soft Delete Implementation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 4. Plan Enforcement Logic
-- This trigger prevents a distributor from exceeding their plan's device limit.
CREATE OR REPLACE FUNCTION public.enforce_device_plan_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_allowed INTEGER;
    d_id UUID;
BEGIN
    -- Resolve distributor_id from the hierarchy
    SELECT z.distributor_id INTO d_id 
    FROM public.communities c
    JOIN public.zones z ON c.zone_id = z.id
    WHERE c.id = NEW.community_id;

    IF d_id IS NULL THEN
        RETURN NEW; -- No distributor context, allow (though unlikely in prod)
    END IF;

    -- Get max_devices for the distributor's plan
    SELECT p.max_devices INTO max_allowed
    FROM public.distributors d
    JOIN public.plans p ON d.plan_id = p.id
    WHERE d.id = d_id;

    -- Default to 3 if no plan found (safety)
    IF max_allowed IS NULL THEN max_allowed := 3; END IF;

    -- Count active (non-deleted) devices in this distributor
    SELECT COUNT(*) INTO current_count
    FROM public.devices dev
    JOIN public.communities c ON dev.community_id = c.id
    JOIN public.zones z ON c.zone_id = z.id
    WHERE z.distributor_id = d_id AND dev.deleted_at IS NULL;

    IF current_count >= max_allowed THEN
        RAISE EXCEPTION 'Device limit reached for your current plan (Limit: %). Upgrade to add more devices.', max_allowed;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_device_limit ON public.devices;
CREATE TRIGGER trg_enforce_device_limit
BEFORE INSERT ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_device_plan_limit();

-- 5. Global updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all major tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
        EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at()', t);
    END LOOP;
END;
$$;
