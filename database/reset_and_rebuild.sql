-- ============================================================================
-- EVARATECH DATABASE RESET & REBUILD (Unified & Future-Proofed)
-- ============================================================================
-- Run this in your Supabase SQL Editor.
-- This script is a complete combination of teardown, table generation and RLS.
--
-- What it does:
--   1. Drops ALL legacy/unused tables and triggers safely.
--   2. Creates the 7 core tables essential for EvaraTech.
--   3. Adds a trigger to sync Supabase Auth signups to the public.users table.
--   4. Enables strict Role-Based Row-Level Security (RLS) on all tables.
--   5. Seeds sample geographical data and applies Superadmin roles.
--
-- ⚠️  WARNING: This will DELETE ALL existing data.
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: NUKE EVERYTHING (CLEAN SLATE)                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DROP VIEW IF EXISTS community_stats CASCADE;
DROP VIEW IF EXISTS customer_device_summary CASCADE;
DROP VIEW IF EXISTS region_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role() CASCADE;

DROP TABLE IF EXISTS device_thingspeak_mapping CASCADE;
DROP TABLE IF EXISTS device_config_tank CASCADE;
DROP TABLE IF EXISTS device_config_deep CASCADE;
DROP TABLE IF EXISTS device_config_flow CASCADE;
DROP TABLE IF EXISTS device_group_memberships CASCADE;
DROP TABLE IF EXISTS device_groups CASCADE;
DROP TABLE IF EXISTS device_health_history CASCADE;
DROP TABLE IF EXISTS device_states CASCADE;
DROP TABLE IF EXISTS node_analytics CASCADE;
DROP TABLE IF EXISTS node_assignments CASCADE;
DROP TABLE IF EXISTS node_readings CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS frontend_errors CASCADE;
DROP TABLE IF EXISTS maintenance_windows CASCADE;
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS distributors CASCADE;
DROP TABLE IF EXISTS users_profiles CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS communities CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 2: CORE TABLES CREATION                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE regions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    state       VARCHAR(100),
    country     VARCHAR(100) DEFAULT 'India',
    zone_code   VARCHAR(20),
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    geo_boundary JSONB,
    regional_admin_id UUID,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_regions_name ON regions(name);
CREATE INDEX idx_regions_active ON regions(is_active);

CREATE TABLE communities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    region_id           UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    address             TEXT,
    pincode             VARCHAR(10),
    contact_person      VARCHAR(200),
    contact_email       VARCHAR(200),
    contact_phone       VARCHAR(20),
    operational_status  VARCHAR(30) DEFAULT 'active' CHECK (operational_status IN ('active', 'inactive', 'maintenance', 'planned')),
    notes               TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_communities_region ON communities(region_id);

CREATE TABLE profiles (
    id              UUID PRIMARY KEY,  -- Matches Supabase auth.users.id
    email           VARCHAR(255) NOT NULL UNIQUE,
    display_name    VARCHAR(200),
    full_name       VARCHAR(200),
    phone_number    VARCHAR(20),
    role            VARCHAR(30) DEFAULT 'customer' CHECK (role IN ('superadmin', 'distributor', 'customer', 'operator', 'viewer')),
    community_id    UUID REFERENCES communities(id) ON DELETE SET NULL,
    status          VARCHAR(30) DEFAULT 'active',
    last_login      TIMESTAMPTZ,
    created_by      UUID,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE TABLE devices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_key                VARCHAR(100) NOT NULL UNIQUE,
    label                   VARCHAR(200) NOT NULL,
    name                    VARCHAR(200),
    serial_number           VARCHAR(100) UNIQUE,
    asset_type              VARCHAR(50),
    asset_category          VARCHAR(50),
    device_type             VARCHAR(50),
    physical_category       VARCHAR(50),
    analytics_template      VARCHAR(50),
    category                VARCHAR(50),
    status                  VARCHAR(30) DEFAULT 'active',
    device_status           VARCHAR(30) DEFAULT 'online' CHECK (device_status IN ('online', 'offline', 'maintenance', 'decommissioned')),
    is_active               VARCHAR(10) DEFAULT 'true',
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    lat                     DOUBLE PRECISION,
    lng                     DOUBLE PRECISION,
    location_name           VARCHAR(200),
    location_description    TEXT,
    capacity                VARCHAR(50),
    specifications          TEXT,
    firmware_version        VARCHAR(50),
    hardware_model          VARCHAR(100),
    installation_date       TIMESTAMPTZ,
    polling_interval        INTEGER DEFAULT 300,
    alert_thresholds        JSONB DEFAULT '{}',
    thingspeak_channel_id   VARCHAR(50),
    thingspeak_read_key     VARCHAR(100),
    thingspeak_write_key    VARCHAR(100),
    field_mapping           JSONB DEFAULT '{}',
    community_id            UUID REFERENCES communities(id) ON DELETE SET NULL,
    customer_id             UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_id                 UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
    metadata                JSONB DEFAULT '{}',
    last_seen               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_community ON devices(community_id);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(50) NOT NULL,
    resource_id     VARCHAR(100),
    details         JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE frontend_errors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message   TEXT NOT NULL,
    stack_trace     TEXT,
    url             TEXT NOT NULL,
    user_agent      TEXT,
    user_id         UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipelines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(200) NOT NULL,
    pipeline_type       VARCHAR(50) NOT NULL CHECK (pipeline_type IN ('main', 'distribution', 'service', 'bypass')),
    from_device_id      UUID REFERENCES devices(id) ON DELETE SET NULL,
    to_device_id        UUID REFERENCES devices(id) ON DELETE SET NULL,
    coordinates         JSONB NOT NULL,
    diameter            VARCHAR(20),
    material            VARCHAR(50),
    installation_type   VARCHAR(50),
    color               VARCHAR(20) DEFAULT '#00b4d8',
    status              VARCHAR(30) DEFAULT 'Active',
    is_active           BOOLEAN DEFAULT TRUE,
    description         TEXT,
    created_by          UUID DEFAULT auth.uid(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 3: HELPER FUNCTIONS                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 4: AUTOMATIC TRIGGERS (TIMESTAMPS & AUTH SYNC)                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TRIGGER trg_regions_updated BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_communities_updated BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pipelines_updated BEFORE UPDATE ON pipelines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-sync Supabase Auth signups into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 5: SECURE DATABSE WITH ROW-LEVEL SECURITY (RLS)                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE frontend_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;

-- REGIONS: Publicly readable for maps, Superadmin writable
CREATE POLICY "regions_select_anon_auth" ON regions FOR SELECT USING (true);
CREATE POLICY "regions_insert_superadmin" ON regions FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "regions_update_superadmin" ON regions FOR UPDATE TO authenticated USING (public.get_user_role() = 'superadmin') WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "regions_delete_superadmin" ON regions FOR DELETE TO authenticated USING (public.get_user_role() = 'superadmin');

-- COMMUNITIES: Publicly readable, Superadmin writable
CREATE POLICY "communities_select_anon_auth" ON communities FOR SELECT USING (true);
CREATE POLICY "communities_insert_superadmin" ON communities FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "communities_update_superadmin" ON communities FOR UPDATE TO authenticated USING (public.get_user_role() = 'superadmin') WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "communities_delete_superadmin" ON communities FOR DELETE TO authenticated USING (public.get_user_role() = 'superadmin');

-- PROFILES: Can read/update own profile, Superadmins can do everything
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.get_user_role() = 'superadmin' OR public.get_user_role() = 'distributor');
CREATE POLICY "profiles_insert_superadmin" ON profiles FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.get_user_role() = 'superadmin') WITH CHECK (id = auth.uid() OR public.get_user_role() = 'superadmin');
CREATE POLICY "profiles_delete_superadmin" ON profiles FOR DELETE TO authenticated USING (public.get_user_role() = 'superadmin');

-- DEVICES: Owners get full CRUD, Superadmin gets full CRUD, Anon gets read for maps
CREATE POLICY "devices_select_anon" ON devices FOR SELECT TO anon USING (latitude IS NOT NULL AND longitude IS NOT NULL);
CREATE POLICY "devices_select" ON devices FOR SELECT TO authenticated USING (user_id = auth.uid() OR customer_id = auth.uid() OR public.get_user_role() = 'superadmin' OR (public.get_user_role() = 'distributor' AND community_id IN (SELECT community_id FROM public.profiles WHERE id = auth.uid())));
CREATE POLICY "devices_insert" ON devices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.get_user_role() = 'superadmin');
CREATE POLICY "devices_update" ON devices FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.get_user_role() = 'superadmin') WITH CHECK (user_id = auth.uid() OR public.get_user_role() = 'superadmin');
CREATE POLICY "devices_delete" ON devices FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.get_user_role() = 'superadmin');

-- AUDIT LOGS: Read own logs, insert own logs
CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.get_user_role() = 'superadmin');
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- PIPELINES: Map reading public, but only superadmins can edit
CREATE POLICY "pipelines_select_anon_auth" ON pipelines FOR SELECT USING (true);
CREATE POLICY "pipelines_insert_superadmin" ON pipelines FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "pipelines_update_superadmin" ON pipelines FOR UPDATE TO authenticated USING (public.get_user_role() = 'superadmin') WITH CHECK (public.get_user_role() = 'superadmin');
CREATE POLICY "pipelines_delete_superadmin" ON pipelines FOR DELETE TO authenticated USING (public.get_user_role() = 'superadmin');

-- FRONTEND ERRORS: Any browser can report them
CREATE POLICY "fe_errors_insert_anon" ON frontend_errors FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "fe_errors_insert_auth" ON frontend_errors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fe_errors_select_superadmin" ON frontend_errors FOR SELECT TO authenticated USING (public.get_user_role() = 'superadmin');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 6: SEED SUPERADMIN ROLES AND SAMPLE DATA                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Update roles to 'superadmin' if these accounts exist in Supabase Auth
DO $$
DECLARE
    ritik_id  UUID;
    aditya_id UUID;
    yasha_id  UUID;
BEGIN
    SELECT id INTO ritik_id  FROM auth.users WHERE email = 'ritik@evaratech.com'  LIMIT 1;
    SELECT id INTO aditya_id FROM auth.users WHERE email = 'aditya@evaratech.com' LIMIT 1;
    SELECT id INTO yasha_id  FROM auth.users WHERE email = 'yasha@evaratech.com'  LIMIT 1;

    IF ritik_id IS NOT NULL THEN
        UPDATE profiles SET role = 'superadmin', display_name = 'Ritik', full_name = 'Ritik Kumar', updated_at = NOW() WHERE id = ritik_id;
    END IF;
 
    IF aditya_id IS NOT NULL THEN
        UPDATE profiles SET role = 'superadmin', display_name = 'Aditya', full_name = 'Aditya Deole', updated_at = NOW() WHERE id = aditya_id;
    END IF;
 
    IF yasha_id IS NOT NULL THEN
        UPDATE profiles SET role = 'superadmin', display_name = 'Yasha', full_name = 'Yasha', updated_at = NOW() WHERE id = yasha_id;
    END IF;
END $$;

INSERT INTO regions (name, state, country, zone_code, description, is_active) VALUES
    ('Hyderabad Central',   'Telangana',   'India', 'HYD-C', 'Central Hyderabad zone covering Banjara Hills, Jubilee Hills, Madhapur', TRUE),
    ('Hyderabad East',      'Telangana',   'India', 'HYD-E', 'Eastern zone covering LB Nagar, Dilsukhnagar, Uppal', TRUE),
    ('Hyderabad West',      'Telangana',   'India', 'HYD-W', 'Western zone covering Gachibowli, HITEC City, Kondapur', TRUE),
    ('Secunderabad',        'Telangana',   'India', 'SEC',   'Secunderabad and Cantonment area', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO communities (name, region_id, address, pincode, operational_status) VALUES
    ('Greenwood Heights',     (SELECT id FROM regions WHERE name = 'Hyderabad Central'), 'Banjara Hills Road No. 12', '500034', 'active'),
    ('Cyber Towers',          (SELECT id FROM regions WHERE name = 'Hyderabad West'),    'HITEC City, Madhapur',      '500081', 'active'),
    ('Prestige Meridian',     (SELECT id FROM regions WHERE name = 'Hyderabad Central'), 'Jubilee Hills Check Post',  '500033', 'active'),
    ('Silicon Valley Enclave', (SELECT id FROM regions WHERE name = 'Hyderabad West'),   'Gachibowli, Near DLF',      '500032', 'active'),
    ('Lake View Residency',   (SELECT id FROM regions WHERE name = 'Hyderabad East'),    'Hussain Sagar Road',        '500063', 'active'),
    ('Paradise Towers',       (SELECT id FROM regions WHERE name = 'Secunderabad'),      'MG Road, Secunderabad',     '500003', 'active')
ON CONFLICT DO NOTHING;
