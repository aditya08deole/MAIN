-- ============================================================
-- P1: Enable PostgreSQL Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ============================================================
-- P0: Clean Slate - Drop All Existing Tables & Objects
-- (Careful: This deletes ALL data. Only for fresh setup.)
-- ============================================================

-- Drop materialized views first
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats CASCADE;

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
DROP TABLE IF EXISTS maintenance_windows CASCADE;
DROP TABLE IF EXISTS device_group_memberships CASCADE;
DROP TABLE IF EXISTS device_groups CASCADE;
DROP TABLE IF EXISTS device_health_history CASCADE;
DROP TABLE IF EXISTS device_states CASCADE;
DROP TABLE IF EXISTS node_readings CASCADE;
DROP TABLE IF EXISTS alert_history CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;
DROP TABLE IF EXISTS node_analytics CASCADE;
DROP TABLE IF EXISTS device_thingspeak_mapping CASCADE;
DROP TABLE IF EXISTS device_config_flow CASCADE;
DROP TABLE IF EXISTS device_config_deep CASCADE;
DROP TABLE IF EXISTS device_config_tank CASCADE;
DROP TABLE IF EXISTS node_assignments CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS communities CASCADE;
DROP TABLE IF EXISTS distributors CASCADE;
DROP TABLE IF EXISTS users_profiles CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Drop custom types (enums)
DROP TYPE IF EXISTS node_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS search_nodes(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_node_daily_stats(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_fleet_summary() CASCADE;

-- ============================================================
-- P1a: Base Tables (CREATE IF NOT EXISTS — safe on any DB state)
-- Order matters: referenced tables must come before FK tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             VARCHAR(255) UNIQUE NOT NULL,
    max_devices      INTEGER DEFAULT 5,
    retention_days   INTEGER DEFAULT 30,
    ai_queries_limit INTEGER DEFAULT 50,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role         VARCHAR(50) NOT NULL DEFAULT 'customer'
                   CHECK (role IN ('superadmin','distributor','customer')),
    plan         VARCHAR(50) NOT NULL DEFAULT 'base'
                   CHECK (plan IN ('base','plus','pro')),
    created_by   UUID,
    distributor_id UUID,
    community_id UUID,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS distributors (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(255) NOT NULL,
    region     VARCHAR(255) NOT NULL,
    status     VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users_profiles(id)
);

CREATE TABLE IF NOT EXISTS communities (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(255) UNIQUE NOT NULL,
    region         VARCHAR(255) NOT NULL,
    city           VARCHAR(255),
    status         VARCHAR(50) DEFAULT 'active',
    slug           VARCHAR(255) UNIQUE,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by     UUID REFERENCES users_profiles(id),
    distributor_id UUID REFERENCES distributors(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name        VARCHAR(255) NOT NULL,
    email            VARCHAR(255) UNIQUE NOT NULL,
    supabase_user_id UUID UNIQUE REFERENCES users_profiles(id),
    contact_number   VARCHAR(50),
    joining_date     DATE DEFAULT NOW(),
    status           VARCHAR(50) DEFAULT 'active',
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    community_id     UUID REFERENCES communities(id),
    distributor_id   UUID REFERENCES distributors(id),
    plan_id          UUID REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS nodes (
    id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_key               VARCHAR(255) UNIQUE NOT NULL,
    label                  VARCHAR(255) NOT NULL,
    category               VARCHAR(100) NOT NULL
                             CHECK (category IN ('OHT','Sump','Borewell','GovtBorewell','PumpHouse','FlowMeter')),
    analytics_type         VARCHAR(50) NOT NULL
                             CHECK (analytics_type IN ('EvaraTank','EvaraDeep','EvaraFlow')),
    location_name          VARCHAR(255),
    lat                    DECIMAL(10,8),
    lng                    DECIMAL(11,8),
    capacity               VARCHAR(100),
    status                 VARCHAR(50) DEFAULT 'provisioning'
                             CHECK (status IN ('Online','Offline','Maintenance','Alert','provisioning')),
    thingspeak_channel_id  VARCHAR(255),
    thingspeak_read_api_key VARCHAR(255),
    last_seen              TIMESTAMP WITH TIME ZONE,
    created_by             UUID REFERENCES users_profiles(id),
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_id            UUID REFERENCES customers(id),
    community_id           UUID REFERENCES communities(id),
    distributor_id         UUID REFERENCES distributors(id)
);

CREATE TABLE IF NOT EXISTS node_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id     UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users_profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, user_id)
);

CREATE TABLE IF NOT EXISTS device_config_tank (
    device_id    UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    capacity     INTEGER,
    max_depth    DECIMAL(10,2),
    temp_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS device_config_deep (
    device_id          UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    static_depth       DECIMAL(10,2),
    dynamic_depth      DECIMAL(10,2),
    recharge_threshold DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS device_config_flow (
    device_id           UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    max_flow_rate       DECIMAL(10,2),
    pipe_diameter       DECIMAL(10,2),
    abnormal_threshold  DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS device_thingspeak_mapping (
    device_id      UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    channel_id     VARCHAR(255) NOT NULL,
    read_api_key   VARCHAR(255),
    write_api_key  VARCHAR(255),
    field_mapping  JSONB DEFAULT '{}',
    last_sync_time TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS node_analytics (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id            UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    period_type        VARCHAR(50) NOT NULL
                         CHECK (period_type IN ('hourly','daily','weekly','monthly')),
    period_start       TIMESTAMP WITH TIME ZONE NOT NULL,
    consumption_liters DECIMAL(15,2),
    avg_level_percent  DECIMAL(5,2),
    peak_flow          DECIMAL(10,2),
    metadata           JSONB DEFAULT '{}',
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipelines (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(255) NOT NULL,
    color      VARCHAR(7) DEFAULT '#3b82f6',
    positions  JSONB NOT NULL,
    created_by UUID REFERENCES users_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES users_profiles(id),
    action        VARCHAR(255),
    action_type   VARCHAR(255),
    entity_type   VARCHAR(255),
    resource_type VARCHAR(255),
    entity_id     UUID,
    resource_id   VARCHAR(255),
    metadata      JSONB DEFAULT '{}',
    performed_by  VARCHAR(255),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "timestamp"   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- P1c: Create All Missing Tables
-- (Must be before any index that references them)
-- ============================================================
-- P1c: Create All Missing Tables
-- (Must be before any index that references them)
-- ============================================================

-- node_readings: Raw telemetry storage
CREATE TABLE IF NOT EXISTS node_readings (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id     UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    field_name  VARCHAR(100) NOT NULL,
    value       FLOAT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    data        JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- device_states: Live snapshot / health cache per device
CREATE TABLE IF NOT EXISTS device_states (
    device_id        UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    current_value    FLOAT,
    current_status   VARCHAR(50),
    health_score     FLOAT DEFAULT 1.0,
    confidence_score FLOAT DEFAULT 0.0,
    anomaly_score    FLOAT,
    last_reading_at  TIMESTAMP WITH TIME ZONE,
    readings_24h     INTEGER DEFAULT 0,
    avg_value_24h    FLOAT,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- alert_rules: Per-node configurable thresholds
CREATE TABLE IF NOT EXISTS alert_rules (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id          UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    metric           VARCHAR(100) NOT NULL,
    operator         VARCHAR(10)  NOT NULL,
    threshold        FLOAT        NOT NULL,
    severity         VARCHAR(20)  DEFAULT 'warning',
    enabled          BOOLEAN      DEFAULT TRUE,
    cooldown_minutes INTEGER      DEFAULT 15,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- alert_history: Fired alert log with full lifecycle
CREATE TABLE IF NOT EXISTS alert_history (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id          UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    rule_id          UUID REFERENCES alert_rules(id),
    severity         VARCHAR(20) DEFAULT 'warning',
    category         VARCHAR(100),
    title            VARCHAR(255),
    message          TEXT,
    value_at_time    FLOAT,
    triggered_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_by  UUID REFERENCES users_profiles(id),
    acknowledged_at  TIMESTAMP WITH TIME ZONE,
    resolved_at      TIMESTAMP WITH TIME ZONE,
    resolve_comment  TEXT
);

-- device_health_history: Daily health score timeline
CREATE TABLE IF NOT EXISTS device_health_history (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id        UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    health_score     FLOAT NOT NULL,
    confidence_score FLOAT NOT NULL DEFAULT 0.0,
    readings_count   INTEGER DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(device_id, date)
);

-- device_groups: Logical grouping of nodes
CREATE TABLE IF NOT EXISTS device_groups (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    community_id UUID REFERENCES communities(id),
    created_by   UUID REFERENCES users_profiles(id),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- device_group_memberships
CREATE TABLE IF NOT EXISTS device_group_memberships (
    group_id UUID NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
    node_id  UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, node_id)
);

-- maintenance_windows
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id    UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time   TIMESTAMP WITH TIME ZONE NOT NULL,
    reason     TEXT,
    created_by UUID REFERENCES users_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- webhook_subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url        TEXT NOT NULL,
    events     JSONB   DEFAULT '[]',
    secret     VARCHAR(255),
    active     BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- P2: Database Indexes for Hot Paths
-- (All referenced tables and columns now exist)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_nodes_community_status
    ON nodes(community_id, status);

CREATE INDEX IF NOT EXISTS idx_nodes_distributor
    ON nodes(distributor_id);

CREATE INDEX IF NOT EXISTS idx_nodes_customer
    ON nodes(customer_id);

-- audit_logs: use the new "timestamp" column
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_node_readings_node_time
    ON node_readings(node_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_active
    ON alert_history(node_id, triggered_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_severity
    ON alert_history(severity)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_device_states_health
    ON device_states(health_score);

-- ============================================================
-- P3: Auto-Update Timestamps Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['nodes','communities','distributors','customers','device_states','pipelines']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- P4: Database-Level Audit Trigger
-- Captures all changes to nodes table at DB level
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_user TEXT;
BEGIN
  v_user := COALESCE(current_setting('app.current_user_id', true), 'system');

  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs
        (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
    VALUES (
      gen_random_uuid()::text, 'DELETE', v_user,
      TG_TABLE_NAME, OLD.id::text,
      jsonb_build_object('old_data', row_to_json(OLD)), NOW()
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs
        (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
    VALUES (
      gen_random_uuid()::text, 'UPDATE', v_user,
      TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object('old_data', row_to_json(OLD), 'new_data', row_to_json(NEW)), NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs
        (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
    VALUES (
      gen_random_uuid()::text, 'INSERT', v_user,
      TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object('new_data', row_to_json(NEW)), NOW()
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to nodes table
DROP TRIGGER IF EXISTS audit_nodes ON nodes;
CREATE TRIGGER audit_nodes
  AFTER INSERT OR UPDATE OR DELETE ON nodes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Apply to customers table
DROP TRIGGER IF EXISTS audit_customers ON customers;
CREATE TRIGGER audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- P24: Convert ENUM to VARCHAR (if status is ENUM type)
-- ENUMs can't have new values in same transaction, so convert to VARCHAR
-- ============================================================

DO $$
BEGIN
    -- Check if status column is an ENUM type, convert to VARCHAR if so
    IF EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON a.attrelid = c.oid
        JOIN pg_type t ON a.atttypid = t.oid
        WHERE c.relname = 'nodes'
          AND a.attname = 'status'
          AND t.typname = 'node_status'
    ) THEN
        -- Convert enum to varchar
        ALTER TABLE nodes ALTER COLUMN status TYPE VARCHAR(50);
        
        -- Add CHECK constraint for valid values
        ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_status_check;
        ALTER TABLE nodes ADD CONSTRAINT nodes_status_check
            CHECK (status IN ('Online','Offline','Maintenance','Alert','provisioning'));
    END IF;
END $$;

-- ============================================================
-- P25: Materialized View for Dashboard Stats
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats;
CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT
  COUNT(*) as total_nodes,
  COUNT(*) FILTER (WHERE status = 'Online') as online_nodes,
  COUNT(*) FILTER (WHERE status = 'Offline') as offline_nodes,
  COUNT(*) FILTER (WHERE status = 'Alert') as alert_nodes,
  COUNT(*) FILTER (WHERE status = 'provisioning') as provisioning_nodes
FROM nodes;

-- Create unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats 
  ON mv_dashboard_stats(total_nodes, online_nodes);

-- Refresh function (call from pg_cron or background task)
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 5 minutes (requires pg_cron)
-- SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats()');

-- ============================================================
-- P27: Full-Text Search with pg_trgm
-- ============================================================

-- GIN indexes — use actual DB column names: label, node_key (NOT device_label / hardware_id)
CREATE INDEX IF NOT EXISTS idx_nodes_label_trgm
  ON nodes USING gin (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_nodes_location_trgm
  ON nodes USING gin (location_name gin_trgm_ops);

-- Global search function (correct column names)
CREATE OR REPLACE FUNCTION search_nodes(search_term TEXT)
RETURNS SETOF nodes AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM nodes
  WHERE label    ILIKE '%' || search_term || '%'
     OR node_key ILIKE '%' || search_term || '%'
     OR COALESCE(location_name, '') ILIKE '%' || search_term || '%'
  ORDER BY similarity(label, search_term) DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- P29: Analytics Aggregation Functions
-- ============================================================

-- Per-node daily stats (uses field_name/value columns, not JSON extraction)
CREATE OR REPLACE FUNCTION get_node_daily_stats(
  p_node_id  TEXT,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  stat_date     DATE,
  avg_value     DECIMAL,
  min_value     DECIMAL,
  max_value     DECIMAL,
  reading_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(nr."timestamp")   AS stat_date,
    AVG(nr.value)::DECIMAL AS avg_value,
    MIN(nr.value)::DECIMAL AS min_value,
    MAX(nr.value)::DECIMAL AS max_value,
    COUNT(*)               AS reading_count
  FROM node_readings nr
  WHERE nr.node_id = p_node_id::UUID
    AND nr."timestamp" >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY DATE(nr."timestamp")
  ORDER BY stat_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Fleet-wide summary (uses actual column name: category, NOT device_type)
CREATE OR REPLACE FUNCTION get_fleet_summary()
RETURNS TABLE (
  device_type  TEXT,
  total_count  BIGINT,
  online_count BIGINT,
  avg_health   DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.category                                       AS device_type,
    COUNT(*)                                         AS total_count,
    COUNT(*) FILTER (WHERE n.status = 'Online')      AS online_count,
    COALESCE(AVG(ds.health_score), 0)::DECIMAL       AS avg_health
  FROM nodes n
  LEFT JOIN device_states ds ON ds.device_id = n.id
  GROUP BY n.category
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- P31: Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all relevant tables
ALTER TABLE nodes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules   ENABLE ROW LEVEL SECURITY;

-- Drop before create to avoid duplicate-policy errors on re-runs
DROP POLICY IF EXISTS "superadmin_all_nodes"    ON nodes;
DROP POLICY IF EXISTS "distributor_own_nodes"   ON nodes;
DROP POLICY IF EXISTS "customer_own_devices"    ON nodes;
DROP POLICY IF EXISTS "audit_log_read_only"     ON audit_logs;
DROP POLICY IF EXISTS "audit_log_insert_only"   ON audit_logs;
DROP POLICY IF EXISTS "superadmin_all_readings" ON node_readings;
DROP POLICY IF EXISTS "users_own_readings"      ON node_readings;
DROP POLICY IF EXISTS "superadmin_all_states"   ON device_states;
DROP POLICY IF EXISTS "superadmin_all_alerts"   ON alert_history;
DROP POLICY IF EXISTS "superadmin_all_rules"    ON alert_rules;

-- Superadmin: Full access
CREATE POLICY "superadmin_all_nodes" ON nodes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profiles
      WHERE id::text = auth.uid()::text AND role = 'superadmin'
    )
  );

-- Distributor: See their community nodes
CREATE POLICY "distributor_own_nodes" ON nodes
  FOR SELECT TO authenticated
  USING (
    distributor_id IN (
      SELECT id FROM distributors d
      WHERE d.id = (
        SELECT distributor_id FROM users_profiles WHERE id::text = auth.uid()::text
      )
    )
  );

-- Customer: See their assigned devices only
CREATE POLICY "customer_own_devices" ON nodes
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE supabase_user_id::text = auth.uid()::text
    )
  );

-- Audit Logs: immutable (no UPDATE/DELETE policies = effectively append-only)
CREATE POLICY "audit_log_read_only" ON audit_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "audit_log_insert_only" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- node_readings
CREATE POLICY "superadmin_all_readings" ON node_readings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profiles
      WHERE id::text = auth.uid()::text AND role = 'superadmin'
    )
  );

CREATE POLICY "users_own_readings" ON node_readings
  FOR SELECT TO authenticated
  USING (
    node_id IN (
      SELECT node_id FROM node_assignments
      WHERE user_id::text = auth.uid()::text
    )
  );

-- device_states
CREATE POLICY "superadmin_all_states" ON device_states
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profiles
      WHERE id::text = auth.uid()::text AND role = 'superadmin'
    )
  );

-- alert_history
CREATE POLICY "superadmin_all_alerts" ON alert_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profiles
      WHERE id::text = auth.uid()::text AND role = 'superadmin'
    )
  );

-- alert_rules
CREATE POLICY "superadmin_all_rules" ON alert_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users_profiles
      WHERE id::text = auth.uid()::text AND role = 'superadmin'
    )
  );

-- No UPDATE or DELETE policies on audit_logs = effectively immutable through RLS

-- ============================================================
-- P99: Seed Superadmin User
-- ============================================================

-- Insert superadmin user profiles
INSERT INTO users_profiles (id, email, display_name, role, plan, created_by, community_id)
VALUES 
    ('00004f5f-ab76-444a-9bcb-2c1dd46f9be9'::uuid, 'ritik@evaratech.com', 'ritik', 'superadmin', 'pro', NULL, NULL),
    ('4dcc5372-1ed0-49a0-9a99-7279bfa89ac6'::uuid, 'jagan852@gmail.com', 'jagan', 'customer', 'base', NULL, NULL),
    ('bc242d7e-3e95-40d4-b362-64e6cb1e4e47'::uuid, 'aditya@evaratech.com', 'aditya', 'superadmin', 'pro', NULL, NULL),
    ('f9482d25-6239-4f58-905f-7f3c09c3d8e0'::uuid, 'yasha@evaratech.com', 'yasha', 'superadmin', 'pro', NULL, NULL)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    plan = EXCLUDED.plan,
    display_name = EXCLUDED.display_name;

-- ============================================================
-- IMPORTANT: Set Passwords in Supabase Dashboard
-- ============================================================
-- After running this migration, set passwords for superadmin users:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. For each user (ritik, aditya, yasha):
--    - Click "..." → Reset Password
--    - Set password to: evaratech@1010
--
-- OR use Supabase CLI:
-- supabase auth update ritik@evaratech.com --password=evaratech@1010
-- supabase auth update aditya@evaratech.com --password=evaratech@1010
-- supabase auth update yasha@evaratech.com --password=evaratech@1010
-- ============================================================
