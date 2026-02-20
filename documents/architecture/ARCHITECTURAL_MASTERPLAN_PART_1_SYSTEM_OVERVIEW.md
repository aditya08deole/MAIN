# ARCHITECTURAL MASTERPLAN - PART 1: SYSTEM OVERVIEW & DATA MODELING ANALYSIS

## EXECUTIVE SUMMARY AND SYSTEM CONTEXT

This architectural masterplan represents a comprehensive technical analysis and redesign specification for the EvaraTech IoT Platform backend system. The platform is designed as a multi-tenant water infrastructure management system built on a Python FastAPI backend, PostgreSQL database hosted on Supabase, React TypeScript frontend, and ThingSpeak integration for IoT telemetry ingestion. The system manages hierarchical entities including distributors, communities, customers, and IoT nodes (water tanks, pumps, borewells) with real-time telemetry monitoring, alert management, health scoring, and AI-driven insights. The current implementation represents an evolving codebase that has undergone multiple phases of enhancement but suffers from architectural inconsistencies, performance bottlenecks, naming ambiguities, incomplete abstractions, and scalability concerns that must be addressed to achieve production-grade reliability.

The platform operates in a domain where data accuracy, low-latency updates, and system reliability are mission-critical. Water infrastructure monitoring requires sub-minute latency for critical alerts, millisecond-level query performance for dashboard aggregations, and five-nines availability for production deployments. The current architecture achieves functional correctness but fails to meet these stringent requirements consistently. This document provides a comprehensive diagnostic analysis of every architectural layer, identifies structural weaknesses with precision, and prescribes specific refactoring strategies grounded in distributed systems engineering principles, database optimization theory, and API design best practices.

## CURRENT ARCHITECTURE DIAGNOSTIC ANALYSIS

### High-Level System Topology

The system implements a three-tier architecture consisting of a React SPA frontend, a Python FastAPI backend, and a PostgreSQL database managed by Supabase. The backend exposes RESTful JSON APIs secured with JWT-based authentication using Supabase Auth. The system integrates with ThingSpeak as an external telemetry source, polling channels every 60 seconds via asyncio background tasks. WebSocket connections enable real-time dashboard updates when telemetry or status changes occur. The deployment model targets containerized services on Render with Docker-based builds for both frontend and backend.

The current architecture can be characterized as a monolithic backend with service-layer separation but insufficient abstraction boundaries. The codebase is organized into models, schemas, services, API endpoints, and background tasks, which represents sound foundational structure. However, the implementation suffers from tight coupling between layers, inconsistent dependency injection patterns, mixed concerns within service classes, and a lack of interface-driven design that would enable testability and modularity.

### Database Schema Architecture: Strengths and Critical Flaws

The database schema defined in the 001_backend_excellence.sql migration file exhibits both architectural strengths and significant structural flaws. The schema correctly models multi-tenancy through distributor, community, and customer tables with appropriate foreign key relationships. The nodes table serves as the central entity representing IoT devices with proper geospatial columns (lat, lng), status enumeration, and tenant scoping via distributor_id and community_id. Specialized configuration tables (device_config_tank, device_config_deep, device_config_flow) implement vertical partitioning for device-specific parameters, which is architecturally sound as it avoids sparse column anti-patterns.

However, the schema suffers from critical design flaws. First, the node_readings table stores telemetry using a field_name VARCHAR and value FLOAT pair, which violates relational normalization principles and creates performance bottlenecks. This EAV (Entity-Attribute-Value) anti-pattern forces the system to perform expensive GROUP BY operations on string columns during aggregation queries, prevents efficient indexing strategies, and complicates time-series query optimization. The correct design should implement a dedicated telemetry table with typed columns per metric (water_level FLOAT, temperature FLOAT, tds FLOAT, ph FLOAT, timestamp TIMESTAMPTZ) indexed on (node_id, timestamp) with BRIN or BTREE indexes for time-series range scans.

Second, the DeviceThingSpeakMapping table stores field_mapping as JSONB, which creates a structural coupling between application logic and database schema. This design forces the application layer to parse JSON for every telemetry fetch operation, prevents compile-time validation of field mappings, and makes schema migrations complex. The correct approach is to introduce a telemetry_field_definitions table with columns (node_id, thingspeak_field_name, canonical_field_name, data_type, unit, transformation_function) that establishes a proper relational mapping between ThingSpeak's arbitrary field1-field8 naming and domain-specific names like water_level or tds_ppm.

Third, the nodes table conflates device identity with device configuration. The table contains both immutable identity attributes (node_key, created_at) and frequently updated operational attributes (status, last_seen, updated_at). This design causes row-level lock contention during concurrent status updates and violates the single responsibility principle. The solution is to introduce a node_operational_state table with columns (node_id PRIMARY KEY, status, last_seen, last_telemetry_sync, health_score, updated_at) that can be updated independently without locking the core nodes row.

Fourth, the audit_logs table contains inconsistent column naming with both action and action_type, both entity_type and resource_type, and both entity_id and resource_id. This naming confusion suggests the table evolved through multiple refactorings without cleanup, creating technical debt. The correct design uses consistent naming (action_type, resource_type, resource_id) with a standardized schema enforced through database constraints and application-layer validation.

Fifth, the alert_history table lacks proper indexing for time-based queries. Alerts are queried by triggered_at, resolved_at, and node_id, but the schema only defines a simple index on node_id. For production workloads with millions of alerts, this causes slow query performance when fetching recent unresolved alerts. The solution is composite indexes on (node_id, resolved_at, triggered_at DESC) for the common query pattern "fetch active alerts for node X ordered by recency" and (triggered_at, severity) for dashboards aggregating alerts by severity across time periods.

Sixth, the device_states table implements a caching layer at the database level, which violates separation of concerns. This table stores derived metrics like health_score, confidence_score, and avg_value_24h that should be computed by application-layer services and cached in Redis or Memcached, not persisted in the operational database. The current design creates write amplification (every telemetry ingestion updates both node_readings and device_states) and complicates cache invalidation logic.

### Primary Key and Foreign Key Design Flaws

The schema uses UUID primary keys generated via uuid_generate_v4(), which is architecturally sound for distributed systems and avoids auto-increment collision issues. However, UUIDs have performance implications for B-tree indexes due to random insertion order causing page splits. PostgreSQL 13+ supports UUID v7 (time-ordered UUIDs) which preserve insertion order locality, reducing index fragmentation. The migration should use gen_random_uuid() only for new rows and consider ordered UUIDs for high-throughput tables like node_readings.

The foreign key relationships correctly implement ON DELETE CASCADE for dependent entities (node_readings, device_config_* tables cascade when nodes are deleted), but the schema lacks foreign key constraints between critical relationships like customers.supabase_user_id and users_profiles.id. This missing constraint allows orphaned customer records when users are deleted from Supabase Auth, creating referential integrity violations. The solution is to add explicit CASCADE or SET NULL policies on every foreign key based on business logic requirements.

The nodes table has foreign keys to three parent tables (community_id, distributor_id, customer_id), but the schema does not enforce mutually exclusive tenancy models. A node should belong to exactly one tenant level (either community-owned, distributor-managed, or customer-assigned), not all three simultaneously. The correct design introduces a discriminator column tenant_type ENUM('community', 'distributor', 'customer') with corresponding tenant_id column and CHECK constraints ensuring only one foreign key is non-null based on tenant_type.

### Indexing Strategy: Comprehensive Deficiencies

The current schema defines minimal indexes, relying primarily on primary key indexes and a few explicit indexes on foreign keys. This approach is inadequate for production-scale query performance. Specific indexing deficiencies include: (1) No composite index on (node_id, timestamp) for node_readings, causing slow range scans when fetching recent telemetry. (2) No partial index on alert_history WHERE resolved_at IS NULL for fast "active alerts" queries. (3) No GIN index on nodes(location_name) or communities(slug) for text search operations. (4) No BRIN index on node_readings(timestamp) for time-series range queries, which would dramatically reduce index storage overhead for large historical datasets. (5) No index on audit_logs(timestamp, resource_type) for audit report generation. (6) No covering index on nodes(community_id, status) INCLUDE (id, label, lat, lng) for map rendering queries that need status filtering without full table scans.

The solution requires a comprehensive indexing strategy driven by query pattern analysis. Every API endpoint should be profiled using EXPLAIN ANALYZE to identify sequential scans and expensive sorts. Critical indexes include: CREATE INDEX CONCURRENTLY idx_node_readings_node_time ON node_readings(node_id, timestamp DESC) for recent telemetry queries; CREATE INDEX CONCURRENTLY idx_alert_history_active ON alert_history(node_id, triggered_at DESC) WHERE resolved_at IS NULL for active alert dashboards; CREATE INDEX CONCURRENTLY idx_nodes_geo ON nodes USING GIST(ll_to_earth(lat, lng)) for geospatial proximity queries; CREATE INDEX CONCURRENTLY idx_audit_logs_timeline ON audit_logs(timestamp DESC, action_type) for audit report generation.

### Row-Level Security Implementation Analysis

Supabase enforces Row-Level Security (RLS) policies at the database level using PostgreSQL's RLS feature. The current schema appears to delegate RLS policy definition to Supabase's UI or manual SQL commands external to the migration file, which creates deployment fragmentation. RLS policies are critical for multi-tenancy isolation but are not versioned in the codebase, creating compliance and security risks. The correct approach is to define RLS policies explicitly in the migration file with enable row level security on every tenant-scoped table and corresponding policies like CREATE POLICY customer_view_own_nodes ON nodes FOR SELECT USING (customer_id = current_setting('app.current_user_id')::UUID).

However, RLS has performance implications. PostgreSQL evaluates RLS policies on every query, which adds computational overhead proportional to policy complexity. For high-throughput APIs, RLS can become a bottleneck. The alternative approach is to enforce tenancy at the application layer by injecting WHERE community_id = user.community_id clauses into every query programmatically. This requires strict code review discipline but offers better performance. A hybrid approach uses RLS as a security backstop while application-layer filtering handles primary enforcement.

The current implementation uses current_setting('app.current_user_id') in RLS policies and background task audit functions, but this approach is fragile. The app.current_user_id session variable must be set explicitly for every database connection, which the codebase does not consistently enforce. If a connection fails to SET app.current_user_id before executing queries, RLS policies evaluate to NULL, causing silent authorization failures or overly permissive access. The robust solution is to create a dedicated set_current_user(UUID) stored procedure that sets the session variable and returns confirmation, then call this procedure in the get_db dependency injection function to guarantee context propagation.

### Telemetry Storage Architecture: Fundamental Redesign Required

The current telemetry storage model using node_readings with (field_name, value) pairs is fundamentally incompatible with high-performance time-series workloads. Time-series databases like TimescaleDB (a PostgreSQL extension), InfluxDB, or PostgreSQL with proper partitioning and compression must be considered. The optimal architecture for telemetry storage is PostgreSQL with TimescaleDB hypertables, which automatically partition time-series data into chunks (e.g., daily or weekly chunks) and enable time-based retention policies with automatic chunk expiration.

The redesigned schema should replace node_readings with a telemetry_tank table (for tank/sump metrics) containing columns (node_id, timestamp, water_level_cm, temperature_c, tds_ppm, ph, battery_voltage), a telemetry_flow table (for flow meters) with (node_id, timestamp, flow_rate_lpm, cumulative_volume_l, pressure_bar), and a telemetry_deep table (for borewells) with (node_id, timestamp, static_water_level_m, dynamic_water_level_m, pump_status_enum). Each table uses a composite primary key (node_id, timestamp) and is converted to a TimescaleDB hypertable via SELECT create_hypertable('telemetry_tank', 'timestamp'). This design enables efficient columnar compression (reducing storage by 80-95%), native downsampling via continuous aggregates, and fast time-range queries using chunk-aware execution plans.

TimescaleDB's continuous aggregates feature allows pre-computed rollups like hourly averages or daily maximums to be materialized incrementally, dramatically improving dashboard query performance. For example, a continuous aggregate like CREATE MATERIALIZED VIEW telemetry_tank_hourly WITH (timescaledb.continuous) AS SELECT node_id, time_bucket('1 hour', timestamp) AS hour, AVG(water_level_cm), MAX(temperature_c), MIN(tds_ppm) FROM telemetry_tank GROUP BY node_id, hour enables instant hourly chart rendering without scanning raw data.

The retention policy should align with business requirements. Raw telemetry for Online nodes should be retained for 90 days, then downsampled to hourly averages for 1 year, then daily averages for 5 years, then archived to S3-compatible object storage. TimescaleDB's add_retention_policy() and add_compression_policy() functions automate this lifecycle. For Offline nodes, telemetry can be dropped after 30 days since offline nodes produce no actionable insights from stale data.

### Data Consistency and Concurrency Control Issues

The current codebase uses SQLAlchemy's default isolation level (READ COMMITTED) without explicit transaction boundaries in most service methods. This creates risk of phantom reads, non-repeatable reads, and write skew anomalies in concurrent scenarios. For example, the poll_thingspeak_loop background task reads a node's status, fetches telemetry, processes it, and updates the node's status. If two concurrent executions poll the same node simultaneously, both may update the status to Online or Offline based on stale reads, causing flip-flopping status updates visible to users.

The solution is to use explicit transaction isolation levels and pessimistic locking where appropriate. Critical operations like status updates should use SELECT FOR UPDATE to acquire row-level locks preventing concurrent modifications. The loop should refactor to: async with db.begin(): node = await db.execute(select(Node).where(Node.id == node_id).with_for_update()); ... node.status = new_status; await db.commit(). This prevents race conditions and ensures linearizable status updates.

The alert_engine service creates alert_history records when thresholds are exceeded, but the cooldown mechanism (cooldown_minutes field in alert_rules) is enforced by querying recent alerts and skipping creation if one exists within the window. This approach is vulnerable to race conditions: two concurrent telemetry batches may both query alert_history, find no recent alert, and both create duplicate alerts. The correct implementation uses INSERT ... ON CONFLICT DO NOTHING with a unique constraint on (rule_id, node_id, triggered_at timestamp truncated to minute) to atomically enforce cooldown at the database level.

The DeviceState table updates (health_score, confidence_score, readings_24h) involve read-modify-write operations that are not atomic. The TelemetryProcessor reads the existing state, increments readings_24h, and writes it back. Concurrent telemetry batches cause lost updates. The solution is to use UPDATE device_states SET readings_24h = readings_24h + $1, updated_at = NOW() WHERE device_id = $2 with atomic SQL-level increments instead of application-level read-modify-write.

## DATABASE ARCHITECTURE REDESIGN SPECIFICATION

### Normalized Telemetry Schema Design

The foundation of the redesign is a domain-specific telemetry schema that replaces the generic node_readings EAV table. The new schema introduces three telemetry tables corresponding to the three analytics_type values (EvaraTank, EvaraFlow, EvaraDeep):

```sql
CREATE TABLE telemetry_tank (
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    water_level_cm REAL NOT NULL,
    water_level_percent REAL GENERATED ALWAYS AS (water_level_cm / NULLIF((SELECT max_depth FROM device_config_tank WHERE device_id = node_id), 0) * 100) STORED,
    temperature_c REAL,
    tds_ppm INTEGER,
    ph REAL,
    battery_voltage REAL,
    rssi_dbm SMALLINT,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (node_id, timestamp)
);

CREATE TABLE telemetry_flow (
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    flow_rate_lpm REAL NOT NULL,
    cumulative_volume_liters REAL,
    pressure_bar REAL,
    temperature_c REAL,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (node_id, timestamp)
);

CREATE TABLE telemetry_deep (
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    static_water_level_m REAL,
    dynamic_water_level_m REAL,
    pump_status VARCHAR(20) CHECK (pump_status IN ('running', 'stopped', 'fault')),
    pump_current_a REAL,
    voltage_v REAL,
    energy_kwh REAL,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (node_id, timestamp)
);
```

This design provides several architectural advantages: (1) Type safety: Each metric has a strongly-typed column with appropriate data type (REAL for floating-point sensors, INTEGER for discrete values, TIMESTAMPTZ for temporal data). (2) Computed columns: PostgreSQL generated columns like water_level_percent derive calculated metrics at insert time, eliminating application-layer computation. (3) Schema clarity: Developers reading the schema immediately understand which metrics are available for each device type. (4) Query optimization: Queries filtering on specific metrics (WHERE water_level_cm < 50) use column statistics and indexes efficiently, unlike string-based field_name = 'field1' predicates. (5) Compression efficiency: TimescaleDB's columnar compression achieves 20:1 compression ratios on time-series data with typed columns compared to 5:1 for JSONB.

### TimescaleDB Hypertable Conversion

After creating the typed telemetry tables, convert them to TimescaleDB hypertables for automatic time-based partitioning:

```sql
SELECT create_hypertable('telemetry_tank', 'timestamp', chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('telemetry_flow', 'timestamp', chunk_time_interval => INTERVAL '7 days');
SELECT create_hypertable('telemetry_deep', 'timestamp', chunk_time_interval => INTERVAL '7 days');

-- Enable compression on chunks older than 14 days
SELECT add_compression_policy('telemetry_tank', INTERVAL '14 days');
SELECT add_compression_policy('telemetry_flow', INTERVAL '14 days');
SELECT add_compression_policy('telemetry_deep', INTERVAL '14 days');

-- Automatically drop raw data older than 90 days
SELECT add_retention_policy('telemetry_tank', INTERVAL '90 days');
SELECT add_retention_policy('telemetry_flow', INTERVAL '90 days');
SELECT add_retention_policy('telemetry_deep', INTERVAL '90 days');
```

The chunk_time_interval determines partition granularity. Weekly chunks balance query performance (fewer chunks to scan for month-long date ranges) and maintenance overhead (chunk creation and compression). Compression policies reduce storage costs by 80-95% for time-series data while maintaining query performance for recent uncompressed chunks. Retention policies automatically expire old data without manual DELETE operations that cause table bloat.

### Continuous Aggregates for Dashboard Optimization

Dashboard queries frequently fetch hourly or daily averages for charting. Computing these aggregates on-demand from raw telemetry data is expensive. TimescaleDB continuous aggregates materialize these computations incrementally:

```sql
CREATE MATERIALIZED VIEW telemetry_tank_hourly
WITH (timescaledb.continuous) AS
SELECT 
    node_id,
    time_bucket('1 hour', timestamp) AS hour,
    AVG(water_level_cm) AS avg_water_level,
    MAX(water_level_cm) AS max_water_level,
    MIN(water_level_cm) AS min_water_level,
    AVG(temperature_c) AS avg_temperature,
    AVG(tds_ppm) AS avg_tds,
    COUNT(*) AS reading_count
FROM telemetry_tank
GROUP BY node_id, hour;

CREATE MATERIALIZED VIEW telemetry_tank_daily
WITH (timescaledb.continuous) AS
SELECT 
    node_id,
    time_bucket('1 day', timestamp) AS day,
    AVG(water_level_cm) AS avg_water_level,
    MAX(water_level_cm) AS max_water_level,
    MIN(water_level_cm) AS min_water_level,
    SUM(CASE WHEN water_level_percent < 20 THEN 1 ELSE 0 END) AS low_level_hours,
    COUNT(*) AS reading_count
FROM telemetry_tank
GROUP BY node_id, day;

-- Refresh policies: update aggregates every 30 minutes for hourly data
SELECT add_continuous_aggregate_policy('telemetry_tank_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes');

SELECT add_continuous_aggregate_policy('telemetry_tank_daily',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 hour');
```

This design enables dashboard APIs to query telemetry_tank_hourly instead of raw telemetry_tank for 100-1000x query speedup. The continuous aggregate is incrementally maintained; only new data inserts trigger re-aggregation of affected time buckets, not full table scans.

### Relational ThingSpeak Mapping Table

Replace the JSONB field_mapping with a proper relational mapping table:

```sql
CREATE TABLE thingspeak_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    thingspeak_field_name VARCHAR(20) NOT NULL CHECK (thingspeak_field_name ~ '^field[1-8]$'),
    canonical_field_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('float', 'integer', 'string', 'boolean')),
    unit VARCHAR(50),
    scale_factor REAL DEFAULT 1.0,
    offset REAL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (device_id, thingspeak_field_name),
    UNIQUE (device_id, canonical_field_name)
);

CREATE INDEX idx_thingspeak_mappings_device ON thingspeak_field_mappings(device_id);
```

This table establishes a many-to-one mapping between ThingSpeak's arbitrary field1-field8 names and domain-specific canonical names like water_level_cm. The scale_factor and offset columns support linear transformations (e.g., converting ThingSpeak's raw ADC values to calibrated physical units). The unique constraints prevent misconfiguration where multiple ThingSpeak fields map to the same canonical field or vice versa.

The telemetry ingestion service queries this table once per device and caches the mappings in Redis with a 1-hour TTL. When ThingSpeak returns {"field1": 245, "field2": 28.5}, the service looks up mappings (field1 → water_level_cm, field2 → temperature_c) and inserts into telemetry_tank(node_id, timestamp, water_level_cm, temperature_c) VALUES (node.id, NOW(), 245 * scale_factor + offset, 28.5 * scale_factor + offset).

### Device Operational State Separation

Split the nodes table into identity and operational state:

```sql
-- Original nodes table now contains only immutable/semi-immutable attributes
ALTER TABLE nodes DROP COLUMN status;
ALTER TABLE nodes DROP COLUMN last_seen;

-- New operational state table with frequently updated columns
CREATE TABLE node_operational_state (
    node_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'provisioning' CHECK (status IN ('Online', 'Offline', 'Maintenance', 'Alert')),
    last_seen TIMESTAMPTZ,
    last_telemetry_sync TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER DEFAULT 1  -- Optimistic locking version
);

CREATE INDEX idx_node_operational_status ON node_operational_state(status);
CREATE INDEX idx_node_operational_lastseen ON node_operational_state(last_seen);
```

This separation eliminates row-level lock contention. The nodes table is read-heavy (loaded once for dashboard rendering) while node_operational_state is write-heavy (updated every 60 seconds by background tasks). The version column enables optimistic locking: UPDATE node_operational_state SET status = 'Online', version = version + 1, updated_at = NOW() WHERE node_id = $1 AND version = $2. If the WHERE clause matches no rows, the application knows another transaction modified the row concurrently and retries the operation.

### Audit Log Schema Standardization

Refactor the inconsistent audit_logs table:

```sql
DROP TABLE audit_logs CASCADE;

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users_profiles(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'ACCESS', 'AUTHENTICATE')),
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    request_id UUID,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timeline ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, timestamp DESC);
```

This schema enforces consistent naming (action_type, not action; resource_type, not entity_type) and adds operational fields like ip_address and request_id for compliance and debugging. The request_id correlates audit events with application logs, enabling distributed tracing across services.

### Alert History Optimized Indexing

Refactor alert_history indexes for production query patterns:

```sql
-- Drop existing indexes if any and recreate optimally
CREATE INDEX idx_alert_history_active ON alert_history(node_id, triggered_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_alert_history_timeline ON alert_history(triggered_at DESC, severity);
CREATE INDEX idx_alert_history_resolution ON alert_history(resolved_at, acknowledged_at) WHERE resolved_at IS NOT NULL;
```

The partial index on WHERE resolved_at IS NULL dramatically reduces index size (typically <5% of table size for active alerts) and speeds up the critical "fetch unresolved alerts" query. The timeline index supports dashboard queries like "show all critical alerts from last 7 days ordered by recency". The resolution index enables analytics queries like "average time to resolve by severity".

### Multi-Tenancy Enforcement with Discriminated Unions

Refactor nodes table to enforce mutually exclusive tenancy:

```sql
ALTER TABLE nodes ADD COLUMN tenant_type VARCHAR(20) CHECK (tenant_type IN ('community', 'distributor', 'customer'));
ALTER TABLE nodes ADD CONSTRAINT nodes_tenant_consistency CHECK (
    (tenant_type = 'community' AND community_id IS NOT NULL AND distributor_id IS NULL AND customer_id IS NULL) OR
    (tenant_type = 'distributor' AND distributor_id IS NOT NULL AND community_id IS NULL AND customer_id IS NULL) OR
    (tenant_type = 'customer' AND customer_id IS NOT NULL AND community_id IS NULL AND distributor_id IS NULL)
);

CREATE INDEX idx_nodes_tenant ON nodes(tenant_type, community_id, distributor_id, customer_id);
```

This constraint ensures data integrity. A node cannot simultaneously belong to a community, distributor, and customer, which would violate business logic. The application sets tenant_type explicitly during node creation, and the database enforces consistency.

### Geospatial Indexing for Proximity Queries

Enable PostGIS extension and add spatial indexes:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE nodes ADD COLUMN location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED;

CREATE INDEX idx_nodes_location ON nodes USING GIST(location);
```

This design stores lat/lng as separate columns for backward compatibility but generates a PostGIS GEOGRAPHY column for spatial queries. Queries like "find all nodes within 5km of point (lat, lng)" use the GIST index for sub-millisecond performance: SELECT * FROM nodes WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), 5000).

## DATA MODELING IMPROVEMENTS: MISSING ENTITIES AND RELATIONSHIPS

### Introduce Telemetry Calibration Configuration

IoT sensors drift over time and require periodic calibration. The system should store calibration parameters per device:

```sql
CREATE TABLE device_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    calibration_type VARCHAR(50) NOT NULL CHECK (calibration_type IN ('linear', 'polynomial', 'lookup_table')),
    parameters JSONB NOT NULL,  -- e.g., {"slope": 1.05, "intercept": -2.3} for linear
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_by UUID REFERENCES users_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calibration_device_field ON device_calibration(device_id, field_name, valid_from DESC);
```

The telemetry processor queries the most recent calibration record (WHERE valid_from <= telemetry.timestamp AND (valid_until IS NULL OR valid_until > telemetry.timestamp)) and applies the transformation before storing the reading. This design supports time-based calibration history for auditing and reprocessing historical data.

### Device Firmware Version Tracking

Track firmware versions for remote debugging and update management:

```sql
CREATE TABLE device_firmware (
    device_id UUID PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    firmware_version VARCHAR(50) NOT NULL,
    hardware_revision VARCHAR(50),
    bootloader_version VARCHAR(50),
    last_update TIMESTAMPTZ,
    update_status VARCHAR(50) CHECK (update_status IN ('up_to_date', 'update_available', 'update_in_progress', 'update_failed')),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_firmware_version ON device_firmware(firmware_version);
```

Devices report firmware version during telemetry payload, and the system updates this table. Admins query SELECT firmware_version, COUNT(*) FROM device_firmware GROUP BY firmware_version to identify devices requiring updates.

### Alert Routing and Notification Preferences

Model user notification preferences for alerts:

```sql
CREATE TABLE alert_notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
    severity_min VARCHAR(20) NOT NULL CHECK (severity_min IN ('info', 'warning', 'critical')),
    node_filter JSONB,  -- e.g., {"category": ["OHT", "Sump"], "community_id": "uuid"}
    notification_channels JSONB NOT NULL,  -- e.g., ["email", "sms", "webhook"]
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alert_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES alert_history(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
    notification_channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_alert_notifications_alert ON alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_user ON alert_notifications(user_id, status);
```

When an alert triggers, the alert_engine queries alert_notification_rules to determine which users should receive notifications and via which channels. It inserts pending notifications into alert_notifications, and a background worker processes the queue.

### Device Downtime Tracking for SLA Reporting

Track downtime incidents for SLA compliance:

```sql
CREATE TABLE device_downtime (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    downtime_start TIMESTAMPTZ NOT NULL,
    downtime_end TIMESTAMPTZ,
    downtime_duration_seconds INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (downtime_end - downtime_start))) STORED,
    downtime_reason VARCHAR(255),
    acknowledged_by UUID REFERENCES users_profiles(id),
    resolved_by UUID REFERENCES users_profiles(id),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_downtime_device_timeline ON device_downtime(device_id, downtime_start DESC);
CREATE INDEX idx_downtime_active ON device_downtime(device_id) WHERE downtime_end IS NULL;
```

When a node transitions to Offline status, the system creates a device_downtime record with downtime_start = NOW(). When the node recovers, it updates SET downtime_end = NOW(). The generated column computes duration automatically. SLA reports query SUM(downtime_duration_seconds) / (SELECT EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) FROM telemetry_tank WHERE node_id = $1) to calculate uptime percentage.

### Device Grouping and Tagging

Allow flexible device organization beyond hierarchical communities:

```sql
CREATE TABLE device_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name VARCHAR(100) NOT NULL,
    tag_value VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tag_name, tag_value)
);

CREATE TABLE device_tag_assignments (
    device_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES device_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users_profiles(id),
    PRIMARY KEY (device_id, tag_id)
);

CREATE INDEX idx_device_tags_device ON device_tag_assignments(device_id);
CREATE INDEX idx_device_tags_tag ON device_tag_assignments(tag_id);
```

Tags like environment=production, criticality=high, or maintenance_zone=north enable ad-hoc filtering and bulk operations. Queries like SELECT device_id FROM device_tag_assignments WHERE tag_id IN (SELECT id FROM device_tags WHERE tag_name = 'environment' AND tag_value = 'production') return all production devices.

## NAMING CONVENTION STANDARDIZATION ACROSS CODEBASE

The current codebase exhibits pervasive naming inconsistencies that impede readability and maintainability. Database columns use snake_case (created_at, distributor_id), Python models use snake_case (node_key, last_seen), API JSON responses use camelCase (nodeKey, lastSeen), and some tables have mixed conventions (updated_at vs updatedAt in metadata). The TypeScript frontend uses camelCase for all identifiers. This mismatch requires constant mental translation and creates serialization mapping complexity.

The solution is to enforce strict naming conventions at every layer with automated linting and code generation:

**Database Layer:** All table names and column names use snake_case. Table names are plural (nodes, communities, alert_rules). Column names are singular (node_id, created_at, status). Boolean columns use is_ prefix (is_enabled, is_archived). Timestamp columns use _at suffix (created_at, updated_at, triggered_at). Enum columns use _type suffix when representing categories (action_type, tenant_type, analytics_type).

**Python Layer (Models):** SQLAlchemy models use snake_case for attribute names matching database columns exactly. Class names use PascalCase (Node, AlertHistory, DeviceConfigTank). Relationship attributes use plural for one-to-many (nodes = relationship("Node", back_populates="community")) and singular for one-to-one (config_tank = relationship("DeviceConfigTank")).

**Python Layer (Services):** Service class methods use snake_case (fetch_telemetry(), create_alert()). Service classes use PascalCase with Service suffix (TelemetryProcessorService, AlertEngineService).

**API Layer (Endpoints):** FastAPI path operations use kebab-case for URL paths (/api/v1/dashboard-stats, /api/v1/device-health). Query parameters use snake_case (limit=10, node_id=abc). Response models (Pydantic schemas) use camelCase for JSON field names to match frontend expectations, with alias mapping: class NodeResponse(BaseModel): node_key: str = Field(..., alias="nodeKey"); created_at: datetime = Field(..., alias="createdAt"); class Config: populate_by_name = True.

**Frontend Layer (TypeScript):** All TypeScript interfaces, types, and variables use camelCase. React component names use PascalCase. API service methods use camelCase (fetchDashboardStats(), createNode()).

This convention set eliminates ambiguity. A developer reading nodes.thingspeak_mapping.channel_id in Python immediately knows this maps to database nodes.thingspeak_mapping.channel_id and API response node.thingspeakMapping.channelId. The Pydantic Config class populate_by_name = True allows the backend to accept both snake_case and camelCase JSON input for backward compatibility during migration.

Automated enforcement requires ESLint for TypeScript (eslint-plugin-naming-convention), Pylint for Python (pylint --variable-naming-style=snake_case), and SQLFluff for SQL (SELECT snake_case_columns FROM snake_case_tables). CI/CD pipelines fail builds that violate conventions.

## SUPABASE INTEGRATION ARCHITECTURE: AUTHENTICATION AND DATA FLOW

### Current Supabase Auth Implementation Analysis

The current implementation uses Supabase as the authentication provider and PostgreSQL database host, but the integration is incomplete and architecturally confused. The frontend uses Supabase JS SDK (supabase.auth.signInWithPassword()) to authenticate users, receiving a JWT access token. This token is sent to the FastAPI backend via Authorization: Bearer <token> header. The backend uses jose library to verify the JWT using SUPABASE_JWT_SECRET (the JWT signing key from Supabase project settings).

However, the backend's verify_supabase_token() function in security_supabase.py implements a "dev-bypass" mechanism that accepts tokens starting with dev-bypass- in both development and production environments (restricted to admin emails in production). This design is a critical security vulnerability. Production systems must never accept unauthenticated bypass tokens regardless of email restrictions, as email checks can be bypassed if the email comes from the token itself rather than validated user records. The correct design removes dev-bypass entirely in production and uses environment-specific authentication strategies.

The backend stores user profiles in users_profiles table with columns (id, email, display_name, role, plan). The id column should be the Supabase Auth UUID (auth.users.id from Supabase's internal schema). However, the schema does not enforce a foreign key constraint to Supabase's auth.users table because the backend cannot directly reference Supabase's internal schema from application-defined tables. This creates referential integrity risks.

### Correct Supabase Auth Integration Architecture

The architecturally sound approach to Supabase integration is to treat Supabase Auth as the source of truth for authentication (verifying JWTs) but maintain application-level user profile tables (users_profiles) in application schema. The integration flow is:

1. **User Registration:** Frontend calls supabase.auth.signUp({email, password}). Supabase creates a user in auth.users and triggers a webhook to backend's POST /api/v1/auth/webhook endpoint. Backend verifies webhook signature using SUPABASE_WEBHOOK_SECRET and creates a corresponding users_profiles record with id = auth_user.id.

2. **User Login:** Frontend calls supabase.auth.signInWithPassword({email, password}). Supabase returns a JWT containing {sub: auth_user.id, email: user.email, app_metadata: {role: "customer"}, ...}. Frontend stores token in localStorage and sends it with every API request.

3. **Token Verification:** Backend's get_current_user_token() dependency extracts the token from Authorization header, decodes it using SUPABASE_JWT_SECRET and algorithms=["HS256"], validates expiration (exp claim), and extracts user_id from sub claim.

4. **User Profile Fetch:** Backend queries SELECT * FROM users_profiles WHERE id = user_id. If no record exists, returns 401 Unauthorized with error "User profile not synchronized". This ensures backend operations never proceed with incomplete user context.

5. **Role-Based Access Control:** Backend checks user.role from database (not from JWT claims, which can be forged if JWT secret leaks) and enforces permissions via RequirePermission dependency. For example, @router.get("/admin/users", dependencies=[Depends(RequirePermission("admin:read_users"))]) enforces that only users with admin:read_users permission can access the endpoint.

The critical architectural principle is: **Never trust JWT claims for authorization decisions. Always fetch authoritative user record from database.** JWTs prove identity (authentication) but not permissions (authorization). Permissions must be fetched from database where they can be revoked instantly. A user with role="admin" in JWT but role="customer" in database should be treated as customer, indicating a role change that occurred after JWT issuance.

### Supabase Row-Level Security Integration

Supabase's RLS policies are defined in Supabase SQL Editor and enforced by PostgreSQL before query execution. The backend should define comprehensive RLS policies in the migration file:

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

-- Superadmin sees everything
CREATE POLICY admin_all_nodes ON nodes FOR ALL USING (
    EXISTS (SELECT 1 FROM users_profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- Distributor sees only their nodes
CREATE POLICY distributor_view_nodes ON nodes FOR SELECT USING (
    EXISTS (SELECT 1 FROM users_profiles WHERE id = auth.uid() AND role = 'distributor' AND distributor_id = nodes.distributor_id)
);

-- Customer sees only their nodes
CREATE POLICY customer_view_nodes ON nodes FOR SELECT USING (
    EXISTS (SELECT 1 FROM users_profiles WHERE id = auth.uid() AND role = 'customer' AND id = nodes.customer_id)
);

-- Similar policies for node_readings, alert_history, etc.
```

However, this approach has a major flaw: auth.uid() returns the user ID from Supabase Auth context, which is only available when using Supabase's client libraries (supabase-js, supabase-py). When the FastAPI backend connects to PostgreSQL directly via asyncpg, auth.uid() returns NULL, causing all RLS policies to fail closed (deny all access). This is why the current implementation uses current_setting('app.current_user_id'), but this requires setting the session variable on every connection.

The robust solution is to create a custom database function set_claims() that accepts user_id and role:

```sql
CREATE OR REPLACE FUNCTION set_user_context(user_id UUID, user_role TEXT) RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::TEXT, false);
    PERFORM set_config('app.current_user_role', user_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

The backend's get_db() dependency calls await db.execute(text("SELECT set_user_context(:uid, :role)"), {"uid": user.id, "role": user.role}) after verifying the JWT and fetching the user profile. RLS policies then use current_setting('app.current_user_id')::UUID instead of auth.uid().

### Supabase Realtime Integration Strategy

Supabase offers a realtime subscription feature (database change notifications via WebSockets). The current backend does not use this feature, instead implementing custom WebSocket broadcasting via FastAPI WebSocketEndpoint and manager.broadcast(). This design is functional but creates operational complexity with managing WebSocket connection lifecycle and broadcast fanout.

A better architecture leverages Supabase Realtime for database change notifications and FastAPI WebSockets for client connections, creating a hybrid pub-sub model:

1. Backend subscribes to Supabase Realtime changes on nodes, alert_history, and node_operational_state tables using Supabase Python client: supabase.table('nodes').on('UPDATE', lambda payload: handle_node_update(payload)).subscribe().

2. The handle_node_update callback broadcasts the change to connected WebSocket clients: await manager.broadcast(json.dumps({"event": "NODE_UPDATE", "node": payload["record"]})).

3. Frontend connects to backend WebSocket endpoint (wss://backend/api/v1/ws/updates) to receive real-time updates.

This design eliminates the need for background tasks to poll database changes and broadcast updates. Database changes propagate instantly via Supabase Realtime, and backend acts as a smart proxy that applies authorization (filtering updates to clients based on their tenancy) and enriches messages (adding computed fields like health_score).

However, Supabase Realtime has limitations: (1) Maximum 100 concurrent realtime connections per project on free tier. (2) No support for row-level filtering in subscriptions (all rows from subscribed table are sent to client, filtering must happen in application code). (3) Eventual consistency guarantees only; under high load, update notifications can lag by seconds. For production deployments with >100 concurrent users, a dedicated pub-sub system like Redis Pub/Sub or NATS is required.

## CONCLUSION OF PART 1

This first section has established the foundational architectural analysis of the EvaraTech IoT Platform backend system, conducting a comprehensive diagnostic evaluation of the database schema, data modeling strategies, and Supabase integration layers. The analysis has identified critical structural flaws including the EAV anti-pattern in telemetry storage, missing indexing strategies, inconsistent naming conventions, insufficient transaction isolation controls, and incomplete authentication flows. The redesign specifications provided prescribe concrete solutions grounded in relational database theory, time-series optimization techniques, and distributed systems engineering principles.

The redesigned schema introduces domain-specific telemetry tables (telemetry_tank, telemetry_flow, telemetry_deep) that replace the generic node_readings table, enabling TimescaleDB hypertable conversion for automatic partitioning and compression. Continuous aggregates provide pre-computed rollups for dashboard queries, achieving 100-1000x performance improvements. The relational thingspeak_field_mappings table replaces JSONB field_mapping, enabling type-safe transformations and compile-time validation. The separation of nodes identity table from node_operational_state eliminates row-level lock contention during concurrent status updates. Comprehensive indexing strategies address specific query patterns identified through workload analysis.

The Supabase integration architecture has been clarified with explicit authentication and authorization flows that separate identity verification (JWT validation) from permission enforcement (database role checks). Row-level security policies are defined with proper session context propagation using set_user_context() stored procedure. The hybrid Supabase Realtime + FastAPI WebSocket model enables low-latency real-time updates while maintaining authorization and message enrichment at the application layer.

Part 2 of this architectural masterplan will address API design patterns, endpoint structuring, response standardization, error handling, pagination strategies, and authentication middleware implementation, focusing on how the redesigned database schema propagates through the service layer to deliver high-performance, maintainable REST APIs.
