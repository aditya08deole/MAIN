-- =============================================================================
-- Migration 009 — Telemetry History, Alert Events, KRB Device Config
-- =============================================================================
-- Run order: after 008_tank_capacity_override.sql
-- Safe to run multiple times (all DDL uses IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. telemetry_history — append-only time-series (Phase B1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS telemetry_history (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id             UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    thingspeak_entry_id   INTEGER,
    timestamp             TIMESTAMPTZ NOT NULL,

    -- Raw ThingSpeak fields (stored as FLOAT for numeric sensors)
    field1  FLOAT,
    field2  FLOAT,
    field3  FLOAT,
    field4  FLOAT,
    field5  FLOAT,
    field6  FLOAT,
    field7  FLOAT,
    field8  FLOAT,

    -- Typed / mapped columns (same set as telemetry_snapshots)
    level_percentage   FLOAT,
    depth_value        FLOAT,
    temperature_value  FLOAT,
    flow_rate          FLOAT,
    total_liters       INTEGER,

    ingested_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast range queries
CREATE INDEX IF NOT EXISTS idx_telemetry_history_device_ts
    ON telemetry_history (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_history_entry_id
    ON telemetry_history (device_id, thingspeak_entry_id);

-- Unique constraint: don't store the same ThingSpeak entry twice
CREATE UNIQUE INDEX IF NOT EXISTS uq_telemetry_history_device_entry
    ON telemetry_history (device_id, thingspeak_entry_id)
    WHERE thingspeak_entry_id IS NOT NULL;

-- RLS: owners can read their own history
ALTER TABLE telemetry_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_read_own_history" ON telemetry_history;
CREATE POLICY "owners_read_own_history" ON telemetry_history
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

-- Service role can write
DROP POLICY IF EXISTS "service_write_history" ON telemetry_history;
CREATE POLICY "service_write_history" ON telemetry_history
    FOR INSERT
    WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 2. alert_events — threshold breach log (Phase C1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    UUID        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    alert_type   TEXT        NOT NULL,   -- "high_temp" | "low_depth" | "no_flow" | "high_flow"
    field_name   TEXT,                   -- "temperature_value" | "depth_value" etc.
    value        FLOAT,                  -- actual measured value
    threshold    FLOAT,                  -- configured threshold
    message      TEXT,                   -- human-readable
    resolved     BOOLEAN     DEFAULT FALSE,
    fired_at     TIMESTAMPTZ DEFAULT now(),
    resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_events_device_fired
    ON alert_events (device_id, fired_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_unresolved
    ON alert_events (device_id, alert_type)
    WHERE resolved = FALSE;

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_read_own_alerts" ON alert_events;
CREATE POLICY "owners_read_own_alerts" ON alert_events
    FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "service_write_alerts" ON alert_events;
CREATE POLICY "service_write_alerts" ON alert_events
    FOR ALL
    WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 3. KRB device credential seed
--    Channel 2613745 (WL8-KRB-01-V5)
--    field1 = Temperature (°C), field2 = Distance/Water Level (cm)
--    Applied to the fallback EvaraDeep device used in EvaraDeepAnalytics.tsx
-- ---------------------------------------------------------------------------

-- 3a. Ensure the fallback device exists and is classified as EvaraDeep
UPDATE devices
   SET asset_type          = 'EvaraDeep',
       analytics_template  = 'EvaraDeep',
       is_active            = TRUE,
       -- Field-mapping: depth=field2 (cm distance), temperature=field1
       device_telemetry_config = jsonb_set(
           COALESCE(device_telemetry_config, '{}'),
           '{field_mapping}',
           '{"depth": "field2", "temperature": "field1"}'::jsonb,
           true
       )
WHERE id = '07d573cc-93e1-45bd-8ffc-af518c8e2fb8';

-- 3b. Upsert device_config_deep with ThingSpeak credentials
INSERT INTO device_config_deep (
    device_id,
    thingspeak_channel_id,
    thingspeak_read_key,
    static_depth,
    recharge_threshold,
    created_at,
    updated_at
)
VALUES (
    '07d573cc-93e1-45bd-8ffc-af518c8e2fb8',
    '2613745',
    'KHJXYW6LEIDQ1TJA',
    200.0,   -- total bore depth (m) — update when physical specs known
    30.0,    -- recharge threshold (m) — alert when water drops below this
    now(),
    now()
)
ON CONFLICT (device_id) DO UPDATE
    SET thingspeak_channel_id = EXCLUDED.thingspeak_channel_id,
        thingspeak_read_key   = EXCLUDED.thingspeak_read_key,
        updated_at            = now();

-- 3c. Add a friendly label so analytics pages show a real device name
UPDATE devices
   SET label = 'KRB Borewell #01'
WHERE id = '07d573cc-93e1-45bd-8ffc-af518c8e2fb8'
  AND (label IS NULL OR label = '' OR label LIKE '%Unnamed%');


-- ---------------------------------------------------------------------------
-- 4. Supabase Realtime — enable for new tables
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_history;
ALTER PUBLICATION supabase_realtime ADD TABLE alert_events;


-- Done.
SELECT 'Migration 009 complete' AS status;
