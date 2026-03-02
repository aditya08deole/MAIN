-- Migration: SaaS Architecture V1 (Distributors, Plans, Normalized Configs)
-- Description: Evolves the flat hierarchy into a multi-tenant B2B SaaS architecture and normalizes the wide `devices` table into 1:1 hardware specialization tables.

BEGIN;

-- ==========================================
-- 1. SaaS MULTI-TENANCY ABSTRACTION
-- ==========================================

-- Drop legacy distributors if empty or mismatched
DROP TABLE IF EXISTS public.distributors CASCADE;

-- [NEW] plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    max_devices INTEGER DEFAULT 5,
    retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [NEW] distributors table
CREATE TABLE IF NOT EXISTS public.distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    region TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indices for tenancy
CREATE INDEX IF NOT EXISTS idx_distributors_plan_id ON public.distributors(plan_id);
CREATE INDEX IF NOT EXISTS idx_distributors_deleted_at ON public.distributors(deleted_at) WHERE deleted_at IS NULL;

-- [MODIFY] zones table: Add distributor_id
ALTER TABLE public.zones 
    ADD COLUMN IF NOT EXISTS distributor_id UUID REFERENCES public.distributors(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_zones_distributor_id ON public.zones(distributor_id);

-- ==========================================
-- 2. HARDWARE CONFIGURATION NORMALIZATION
-- ==========================================

-- [NEW] device_config_tank
CREATE TABLE IF NOT EXISTS public.device_config_tank (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    tank_shape TEXT CHECK (tank_shape IN ('cylinder', 'rectangular')),
    dimension_unit TEXT DEFAULT 'm',
    radius FLOAT,
    height FLOAT,
    length FLOAT,
    breadth FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [NEW] device_config_flow
CREATE TABLE IF NOT EXISTS public.device_config_flow (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    max_flow_rate FLOAT,
    pipe_diameter FLOAT,
    abnormal_threshold FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [NEW] device_config_deep
CREATE TABLE IF NOT EXISTS public.device_config_deep (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    static_depth FLOAT,
    dynamic_depth FLOAT,
    recharge_threshold FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. TELEMETRY INGESTION ARCHIVES
-- ==========================================

-- [NEW] telemetry_snapshots (Latest State Only)
CREATE TABLE IF NOT EXISTS public.telemetry_snapshots (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    last_timestamp TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    mapped_values JSONB, -- Stores { "level": 45.2, "flow": 12.1 } natively
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_device_snapshot UNIQUE (device_id)
);

-- [NEW] telemetry_history (Batched Archival)
CREATE TABLE IF NOT EXISTS public.telemetry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    metrics JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for Telemetry
CREATE INDEX IF NOT EXISTS idx_telemetry_history_device_id ON public.telemetry_history(device_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_history_time ON public.telemetry_history(timestamp DESC);

-- ==========================================
-- 4. UTILITY & AUDIT
-- ==========================================

-- [NEW] ingestion_audit
CREATE TABLE IF NOT EXISTS public.ingestion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    operation TEXT, -- 'pull', 'transform', 'store'
    status TEXT, -- 'success', 'failure'
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_audit_device_id ON public.ingestion_audit(device_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_audit_time ON public.ingestion_audit(created_at DESC);

COMMIT;
