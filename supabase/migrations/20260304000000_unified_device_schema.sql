-- ============================================================
-- Migration: Unified Device Schema
-- Date: 2026-03-04
-- Description:
--   Replaces the split devices + device_config_* tables with
--   3 clean unified tables: evaratank, evaraflow, evaradeep.
--   Each table holds identity + config + credentials in one place.
--   Splits telemetry snapshots into 3 matching tables.
--   Adds superadmin table. Removes redundant tables.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SUPERADMIN TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.superadmin (
    id          UUID PRIMARY KEY,  -- same UUID as Supabase Auth user
    email       TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.superadmin IS 'Profiles for superadmin users (linked to Supabase Auth).';

-- ============================================================
-- 2. UNIFIED DEVICE TABLES
-- ============================================================

-- ── EvaraTank ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaratank (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key              TEXT UNIQUE NOT NULL,
    label                 TEXT NOT NULL,

    -- Location
    latitude              FLOAT,
    longitude             FLOAT,

    -- Hierarchy
    community_id          UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    client_id             UUID REFERENCES public.customers(id)   ON DELETE SET NULL,

    -- ThingSpeak credentials
    thingspeak_channel_id TEXT,
    thingspeak_read_key   TEXT,
    thingspeak_write_key  TEXT,

    -- Field mapping (which ThingSpeak field carries which value)
    water_level_field     TEXT DEFAULT 'field1',
    temperature_field     TEXT DEFAULT 'field2',

    -- Physical tank dimensions
    tank_shape            TEXT DEFAULT 'rectangular',  -- 'rectangular' | 'cylindrical'
    height_m              FLOAT,
    length_m              FLOAT,
    breadth_m             FLOAT,
    radius_m              FLOAT,
    capacity_liters       FLOAT,

    -- Control
    is_active             BOOLEAN DEFAULT TRUE,
    webhook_secret        TEXT,
    last_seen             TIMESTAMPTZ,
    last_fetched_at       TIMESTAMPTZ,

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);
COMMENT ON TABLE public.evaratank IS 'EvaraTank devices — overhead tanks and underground sumps. Identity + config in one table.';

-- ── EvaraFlow ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaraflow (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key              TEXT UNIQUE NOT NULL,
    label                 TEXT NOT NULL,

    latitude              FLOAT,
    longitude             FLOAT,

    community_id          UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    client_id             UUID REFERENCES public.customers(id)   ON DELETE SET NULL,

    thingspeak_channel_id TEXT,
    thingspeak_read_key   TEXT,
    thingspeak_write_key  TEXT,

    meter_reading_field   TEXT DEFAULT 'field1',
    flow_rate_field       TEXT DEFAULT 'field2',

    pipe_diameter         FLOAT,
    max_flow_rate         FLOAT,

    is_active             BOOLEAN DEFAULT TRUE,
    webhook_secret        TEXT,
    last_seen             TIMESTAMPTZ,
    last_fetched_at       TIMESTAMPTZ,

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);
COMMENT ON TABLE public.evaraflow IS 'EvaraFlow devices — flow meters and pumps.';

-- ── EvaraDeep ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaradeep (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key              TEXT UNIQUE NOT NULL,
    label                 TEXT NOT NULL,

    latitude              FLOAT,
    longitude             FLOAT,

    community_id          UUID REFERENCES public.communities(id) ON DELETE SET NULL,
    client_id             UUID REFERENCES public.customers(id)   ON DELETE SET NULL,

    thingspeak_channel_id TEXT,
    thingspeak_read_key   TEXT,
    thingspeak_write_key  TEXT,

    -- Field mapping
    depth_field           TEXT DEFAULT 'field2',
    temperature_field     TEXT DEFAULT 'field1',

    -- Borewell specs
    total_bore_depth      FLOAT,
    static_water_level    FLOAT,
    dynamic_water_level   FLOAT,
    recharge_threshold    FLOAT DEFAULT 0,

    is_active             BOOLEAN DEFAULT TRUE,
    webhook_secret        TEXT,
    last_seen             TIMESTAMPTZ,
    last_fetched_at       TIMESTAMPTZ,

    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);
COMMENT ON TABLE public.evaradeep IS 'EvaraDeep devices — borewells and deep wells.';

-- ============================================================
-- 3. SPLIT TELEMETRY SNAPSHOT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evaratank_snapshots (
    device_id             UUID PRIMARY KEY REFERENCES public.evaratank(id) ON DELETE CASCADE,
    thingspeak_entry_id   INT,
    last_timestamp        TIMESTAMPTZ NOT NULL,
    raw_payload           JSONB,
    level_percentage      FLOAT,
    temperature_value     FLOAT,
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.evaratank_snapshots IS 'Latest telemetry reading per EvaraTank device.';

CREATE TABLE IF NOT EXISTS public.evaraflow_snapshots (
    device_id             UUID PRIMARY KEY REFERENCES public.evaraflow(id) ON DELETE CASCADE,
    thingspeak_entry_id   INT,
    last_timestamp        TIMESTAMPTZ NOT NULL,
    raw_payload           JSONB,
    flow_rate             FLOAT,
    total_liters          BIGINT,
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.evaraflow_snapshots IS 'Latest telemetry reading per EvaraFlow device.';

CREATE TABLE IF NOT EXISTS public.evaradeep_snapshots (
    device_id             UUID PRIMARY KEY REFERENCES public.evaradeep(id) ON DELETE CASCADE,
    thingspeak_entry_id   INT,
    last_timestamp        TIMESTAMPTZ NOT NULL,
    raw_payload           JSONB,
    depth_value           FLOAT,
    temperature_value     FLOAT,
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.evaradeep_snapshots IS 'Latest telemetry reading per EvaraDeep device.';

-- ============================================================
-- 4. ADAPT SHARED TABLES (telemetry_history, alert_events)
--    Remove FK to old devices table, add device_type column
--    so we know which of the 3 device tables to join against.
-- ============================================================

-- telemetry_history (exists — just patch it)
ALTER TABLE public.telemetry_history
    DROP CONSTRAINT IF EXISTS telemetry_history_device_id_fkey;
ALTER TABLE public.telemetry_history
    ADD COLUMN IF NOT EXISTS device_type TEXT
        CHECK (device_type IN ('EvaraTank','EvaraFlow','EvaraDeep'));

-- alert_events: CREATE if it doesn't exist, then patch
CREATE TABLE IF NOT EXISTS public.alert_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id   UUID NOT NULL,
    device_type TEXT CHECK (device_type IN ('EvaraTank','EvaraFlow','EvaraDeep')),
    alert_type  TEXT NOT NULL,
    field_name  TEXT,
    value       FLOAT,
    threshold   FLOAT,
    message     TEXT,
    resolved    BOOLEAN DEFAULT FALSE,
    fired_at    TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
COMMENT ON TABLE public.alert_events IS 'Alerts fired across all device types.';

-- Drop stale FK if the table pre-existed with one
ALTER TABLE public.alert_events
    DROP CONSTRAINT IF EXISTS alert_events_device_id_fkey;
-- Ensure device_type column exists (no-op if CREATE above already added it)
ALTER TABLE public.alert_events
    ADD COLUMN IF NOT EXISTS device_type TEXT
        CHECK (device_type IN ('EvaraTank','EvaraFlow','EvaraDeep'));

-- audit_logs — make user_id nullable (superadmin does not always have a customers row)
ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
    ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================
-- 5. INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_evaratank_community  ON public.evaratank(community_id);
CREATE INDEX IF NOT EXISTS idx_evaratank_client      ON public.evaratank(client_id);
CREATE INDEX IF NOT EXISTS idx_evaratank_active      ON public.evaratank(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evaraflow_community  ON public.evaraflow(community_id);
CREATE INDEX IF NOT EXISTS idx_evaraflow_client      ON public.evaraflow(client_id);
CREATE INDEX IF NOT EXISTS idx_evaraflow_active      ON public.evaraflow(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evaradeep_community  ON public.evaradeep(community_id);
CREATE INDEX IF NOT EXISTS idx_evaradeep_client      ON public.evaradeep(client_id);
CREATE INDEX IF NOT EXISTS idx_evaradeep_active      ON public.evaradeep(is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telemetry_history_device_type ON public.telemetry_history(device_type, device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_device_type      ON public.alert_events(device_type, device_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

-- superadmin
ALTER TABLE public.superadmin ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='superadmin' AND policyname='superadmin_all_authenticated') THEN
    CREATE POLICY "superadmin_all_authenticated" ON public.superadmin FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='superadmin' AND policyname='superadmin_service_role') THEN
    CREATE POLICY "superadmin_service_role" ON public.superadmin FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- evaratank
ALTER TABLE public.evaratank ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaratank' AND policyname='evaratank_all_authenticated') THEN
    CREATE POLICY "evaratank_all_authenticated" ON public.evaratank FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaratank' AND policyname='evaratank_service_role') THEN
    CREATE POLICY "evaratank_service_role" ON public.evaratank FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- evaraflow
ALTER TABLE public.evaraflow ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaraflow' AND policyname='evaraflow_all_authenticated') THEN
    CREATE POLICY "evaraflow_all_authenticated" ON public.evaraflow FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaraflow' AND policyname='evaraflow_service_role') THEN
    CREATE POLICY "evaraflow_service_role" ON public.evaraflow FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- evaradeep
ALTER TABLE public.evaradeep ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaradeep' AND policyname='evaradeep_all_authenticated') THEN
    CREATE POLICY "evaradeep_all_authenticated" ON public.evaradeep FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaradeep' AND policyname='evaradeep_service_role') THEN
    CREATE POLICY "evaradeep_service_role" ON public.evaradeep FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- snapshot tables
ALTER TABLE public.evaratank_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaratank_snapshots' AND policyname='evaratank_snaps_all') THEN
    CREATE POLICY "evaratank_snaps_all" ON public.evaratank_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaratank_snapshots' AND policyname='evaratank_snaps_svc') THEN
    CREATE POLICY "evaratank_snaps_svc" ON public.evaratank_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.evaraflow_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaraflow_snapshots' AND policyname='evaraflow_snaps_all') THEN
    CREATE POLICY "evaraflow_snaps_all" ON public.evaraflow_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaraflow_snapshots' AND policyname='evaraflow_snaps_svc') THEN
    CREATE POLICY "evaraflow_snaps_svc" ON public.evaraflow_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE public.evaradeep_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaradeep_snapshots' AND policyname='evaradeep_snaps_all') THEN
    CREATE POLICY "evaradeep_snaps_all" ON public.evaradeep_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='evaradeep_snapshots' AND policyname='evaradeep_snaps_svc') THEN
    CREATE POLICY "evaradeep_snaps_svc" ON public.evaradeep_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- alert_events
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_events' AND policyname='alert_events_all_authenticated') THEN
    CREATE POLICY "alert_events_all_authenticated" ON public.alert_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alert_events' AND policyname='alert_events_service_role') THEN
    CREATE POLICY "alert_events_service_role" ON public.alert_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 7. TRIGGER: auto-update updated_at on evaratank/flow/deep
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_evaratank_updated_at') THEN
        CREATE TRIGGER trg_evaratank_updated_at
            BEFORE UPDATE ON public.evaratank
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_evaraflow_updated_at') THEN
        CREATE TRIGGER trg_evaraflow_updated_at
            BEFORE UPDATE ON public.evaraflow
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_evaradeep_updated_at') THEN
        CREATE TRIGGER trg_evaradeep_updated_at
            BEFORE UPDATE ON public.evaradeep
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- ============================================================
-- 8. DROP OLD REDUNDANT TABLES
--    Order matters: drop dependent tables first.
-- ============================================================

-- Snapshots that reference old devices table
DROP TABLE IF EXISTS public.telemetry_snapshots CASCADE;

-- Per-device config tables (merged into unified device tables above)
DROP TABLE IF EXISTS public.device_config_tank    CASCADE;
DROP TABLE IF EXISTS public.device_config_deep    CASCADE;
DROP TABLE IF EXISTS public.device_config_flow    CASCADE;

-- Other redundant tables
DROP TABLE IF EXISTS public.frontend_errors       CASCADE;
DROP TABLE IF EXISTS public.clients               CASCADE;
DROP TABLE IF EXISTS public.pipelines             CASCADE;
DROP TABLE IF EXISTS public.device_shares         CASCADE;
DROP TABLE IF EXISTS public.ingestion_audit       CASCADE;

-- Old devices table (must come AFTER config tables are dropped)
DROP TABLE IF EXISTS public.devices               CASCADE;

-- ============================================================
-- 9. GRANT service_role full access to all tables
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

COMMIT;
