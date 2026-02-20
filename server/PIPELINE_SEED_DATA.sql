-- ============================================================
-- PIPELINE & INFRASTRUCTURE SEED DATA FOR IIIT HYDERABAD
-- This adds all water infrastructure entities (pumps, sumps, tanks, borewells, pipelines)
-- from the existing HTML map to the Supabase database
-- ============================================================

-- ============================================================
-- FIX AUDIT TRIGGER UUID CASTING ERROR (run this first!)
-- ============================================================
DO $$
BEGIN
    -- Drop existing audit triggers to recreate with proper UUID handling
    DROP TRIGGER IF EXISTS audit_trigger ON nodes CASCADE;
    DROP TRIGGER IF EXISTS audit_trigger ON communities CASCADE;
    DROP TRIGGER IF EXISTS audit_trigger ON distributors CASCADE;
    DROP TRIGGER IF EXISTS audit_trigger ON pipelines CASCADE;
    DROP FUNCTION IF EXISTS audit_trigger_func() CASCADE;
    
    -- Create fixed audit trigger function
    CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS TRIGGER AS $func$
    DECLARE
        v_user TEXT;
    BEGIN
        v_user := coalesce(current_setting('app.current_user_id', true), 'system');
        
        -- FIX: Use gen_random_uuid() WITHOUT ::text cast (audit_logs.id is UUID type)
        IF TG_OP = 'INSERT' THEN
            INSERT INTO audit_logs (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
            VALUES (
                gen_random_uuid(),  -- Already UUID, no cast
                'INSERT',
                v_user,
                TG_TABLE_NAME,
                NEW.id::text,  -- Cast resource_id to text
                jsonb_build_object('new_data', row_to_json(NEW)),
                NOW()
            );
        ELSIF TG_OP = 'UPDATE' THEN
            INSERT INTO audit_logs (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
            VALUES (
                gen_random_uuid(),
                'UPDATE',
                v_user,
                TG_TABLE_NAME,
                NEW.id::text,
                jsonb_build_object('old_data', row_to_json(OLD), 'new_data', row_to_json(NEW)),
                NOW()
            );
        ELSIF TG_OP = 'DELETE' THEN
            INSERT INTO audit_logs (id, action_type, performed_by, resource_type, resource_id, metadata, "timestamp")
            VALUES (
                gen_random_uuid(),
                'DELETE',
                v_user,
                TG_TABLE_NAME,
                OLD.id::text,
                jsonb_build_object('old_data', row_to_json(OLD)),
                NOW()
            );
        END IF;
        
        RETURN COALESCE(NEW, OLD);
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Recreate triggers
    CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON nodes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    
    CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON communities
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    
    CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON distributors
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
    
    RAISE NOTICE '✓ Audit triggers fixed - UUID casting error resolved';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Audit trigger fix skipped (may not exist yet): %', SQLERRM;
END $$;

-- ============================================================
-- INSERT DISTRIBUTOR & COMMUNITY
-- ============================================================
-- First, ensure we have a default community and distributor
-- Using proper UUIDs for PostgreSQL UUID columns
INSERT INTO distributors (id, name, region, status, created_at)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'IIIT Hyderabad', 'Telangana', 'active', NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region;

INSERT INTO communities (id, name, region, city, status, slug, distributor_id, created_at)
VALUES ('b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'IIIT Hyderabad Campus', 'Telangana', 'Hyderabad', 'active', 'iiit-campus', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region, city = EXCLUDED.city;

-- ============================================================
-- INSERT PUMP HOUSES
-- ============================================================
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
(gen_random_uuid(), 'PH-01', 'Pump House 1', 'PumpHouse', 'EvaraFlow', 'ATM Gate', 17.4456, 78.3516, '4.98L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'PH-02', 'Pump House 2', 'PumpHouse', 'EvaraFlow', 'Guest House', 17.44608, 78.34925, '75k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'PH-03', 'Pump House 3', 'PumpHouse', 'EvaraFlow', 'Staff Qtrs', 17.4430, 78.3487, '55k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'PH-04', 'Pump House 4', 'PumpHouse', 'EvaraFlow', 'Bakul', 17.4481, 78.3489, '2.00L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (node_key) DO UPDATE SET 
    label = EXCLUDED.label,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status;

-- ============================================================
-- INSERT SUMPS
-- ============================================================
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
(gen_random_uuid(), 'SUMP-S1', 'Sump S1', 'Sump', 'EvaraTank', 'Bakul', 17.448097, 78.349060, '2.00L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S2', 'Sump S2', 'Sump', 'EvaraTank', 'Palash', 17.444919, 78.346195, '1.10L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S3', 'Sump S3', 'Sump', 'EvaraTank', 'NBH', 17.446779, 78.346996, '1.00L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S4', 'Sump S4 (Main Sump)', 'Sump', 'EvaraTank', 'Central', 17.445630, 78.351593, '4.98L L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S5', 'Sump S5', 'Sump', 'EvaraTank', 'Blk A&B', 17.444766, 78.350087, '55k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S6', 'Sump S6', 'Sump', 'EvaraTank', 'Guest House', 17.445498, 78.350202, '10k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S7', 'Sump S7', 'Sump', 'EvaraTank', 'Pump House', 17.44597, 78.34906, '43k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S8', 'Sump S8', 'Sump', 'EvaraTank', 'Football', 17.446683, 78.348995, '12k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S9', 'Sump S9', 'Sump', 'EvaraTank', 'Felicity', 17.446613, 78.346487, '15k L', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S10', 'Sump S10', 'Sump', 'EvaraTank', 'FSQ A&B', 17.443076, 78.348737, '34k+31k', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'SUMP-S11', 'Sump S11', 'Sump', 'EvaraTank', 'FSQ C,D,E', 17.444773, 78.347797, '1.5L+60k', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (node_key) DO UPDATE SET 
    label = EXCLUDED.label,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status;

-- ============================================================
-- INSERT OVERHEAD TANKS (OHT)
-- ============================================================
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
(gen_random_uuid(), 'OHT-1', 'Bakul OHT', 'OHT', 'EvaraTank', 'Bakul', 17.448045, 78.348438, '2 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-2', 'Parijat OHT', 'OHT', 'EvaraTank', 'Parijat', 17.447547, 78.347752, '2 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-3', 'Kadamba OHT', 'OHT', 'EvaraTank', 'Kadamba', 17.446907, 78.347178, '2 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-4', 'NWH Block C OHT', 'OHT', 'EvaraTank', 'NWH Block C', 17.447675, 78.347430, '1 Unit', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-5', 'NWH Block B OHT', 'OHT', 'EvaraTank', 'NWH Block B', 17.447391, 78.347172, '1 Unit', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-6', 'NWH Block A OHT', 'OHT', 'EvaraTank', 'NWH Block A', 17.447081, 78.346884, '1 Unit', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-7', 'Palash Nivas OHT', 'OHT', 'EvaraTank', 'Palash Nivas', 17.445096, 78.345966, '4 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-8', 'Anand Nivas OHT', 'OHT', 'EvaraTank', 'Anand Nivas', 17.443976, 78.348432, '2 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-9', 'Budha Nivas OHT', 'OHT', 'EvaraTank', 'Budha Nivas', 17.443396, 78.348500, '2 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-10', 'C Block OHT', 'OHT', 'EvaraTank', 'C Block', 17.443387, 78.347834, '3 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-11', 'D Block OHT', 'OHT', 'EvaraTank', 'D Block', 17.443914, 78.347773, '3 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-12', 'E Block OHT', 'OHT', 'EvaraTank', 'E Block', 17.444391, 78.347958, '3 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-13', 'Vindhya OHT', 'OHT', 'EvaraTank', 'Vindhya', 17.44568, 78.34973, '4 Units', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'OHT-14', 'Himalaya OHT', 'OHT', 'EvaraTank', 'Himalaya (KRB)', 17.44525, 78.34966, '1 Unit', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (node_key) DO UPDATE SET 
    label = EXCLUDED.label,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status;

-- ============================================================
-- INSERT IIIT BOREWELLS
-- ============================================================
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
(gen_random_uuid(), 'BW-P1', 'Borewell P1', 'Borewell', 'EvaraDeep', 'Block C,D,E', 17.443394, 78.348117, '5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P2', 'Borewell P2', 'Borewell', 'EvaraDeep', 'Agri Farm', 17.443093, 78.348936, '12.5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P3', 'Borewell P3', 'Borewell', 'EvaraDeep', 'Palash', 17.444678, 78.347234, '5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P4', 'Borewell P4', 'Borewell', 'EvaraDeep', 'Vindhya', 17.446649, 78.350578, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P5', 'Borewell P5', 'Borewell', 'EvaraDeep', 'Nilgiri', 17.447783, 78.349040, '5 HP', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P6', 'Borewell P6', 'Borewell', 'EvaraDeep', 'Bakul', 17.448335, 78.348594, '5/7.5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P7', 'Borewell P7', 'Borewell', 'EvaraDeep', 'Volleyball', 17.445847, 78.346416, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P8', 'Borewell P8', 'Borewell', 'EvaraDeep', 'Palash', 17.445139, 78.345277, '7.5 HP', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P9', 'Borewell P9', 'Borewell', 'EvaraDeep', 'Girls Blk A', 17.446922, 78.346699, '7.5 HP', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P10', 'Borewell P10', 'Borewell', 'EvaraDeep', 'Parking NW', 17.443947, 78.350139, '5 HP', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P10A', 'Borewell P10A', 'Borewell', 'EvaraDeep', 'Agri Farm', 17.443451, 78.349635, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-P11', 'Borewell P11', 'Borewell', 'EvaraDeep', 'Blk C,D,E', 17.444431, 78.347649, '5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (node_key) DO UPDATE SET 
    label = EXCLUDED.label,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status;

-- ============================================================
-- INSERT GOVERNMENT BOREWELLS
-- ============================================================
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
(gen_random_uuid(), 'BW-G1', 'Borewell 1 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Palash', 17.444601, 78.345459, '5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G2', 'Borewell 2 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Palash', 17.445490, 78.346838, '1.5 HP', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G3', 'Borewell 3 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Vindhaya C4', 17.446188, 78.350067, '5 HP', 'Online', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G4', 'Borewell 4 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Entrance', 17.447111, 78.350151, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G5', 'Borewell 5 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Entrance', 17.446311, 78.351042, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G6', 'Borewell 6 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Bamboo House', 17.445584, 78.347148, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW()),
(gen_random_uuid(), 'BW-G7', 'Borewell 7 (Govt)', 'GovtBorewell', 'EvaraDeep', 'Football', 17.446115, 78.348536, 'N/A', 'Offline', 'b1c2d3e4-f5a6-7890-bcde-ef1234567891'::uuid, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, NOW())
ON CONFLICT (node_key) DO UPDATE SET 
    label = EXCLUDED.label,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    status = EXCLUDED.status;

-- ============================================================
-- INSERT PIPELINES (Water Supply Lines)
-- ============================================================
-- Note: Using specific UUIDs for idempotency. Drop ON CONFLICT since name is unique.
DELETE FROM pipelines WHERE name LIKE 'PH%' OR name LIKE 'P%→%';

INSERT INTO pipelines (id, name, color, positions, created_at) VALUES
('11111111-1111-1111-1111-000000000001'::uuid, 'PH2 → OBH/PALASH', '#00b4d8', '[[78.3492569095647, 17.446057476630784], [78.34825099866276, 17.445482194972044], [78.34720892666434, 17.44630656687505], [78.34598638379146, 17.445050104381707]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000002'::uuid, 'PH2 → KADAMBA/NBH', '#00b4d8', '[[78.34717428867077, 17.4468858335199], [78.34687317239377, 17.446583646976833], [78.34721168790577, 17.446302774851645]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000003'::uuid, 'PH2 → HIMALAYA', '#00b4d8', '[[78.34925379742043, 17.44605617669069], [78.34908273787016, 17.445883817839018], [78.34973473021046, 17.44532883606179], [78.3496616935484, 17.44524815714857]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000004'::uuid, 'PH2 → VINDYA', '#00b4d8', '[[78.349258777606, 17.446050296030123], [78.34973190965451, 17.44566149363318]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000005'::uuid, 'PH2 → PARIJAT/NGH', '#00b4d8', '[[78.34924741075247, 17.446051955076115], [78.34798068042636, 17.447117930045437], [78.34812314046127, 17.447270012848705], [78.34779469227817, 17.447551631476756]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000006'::uuid, 'PH1 → PH3', '#00b4d8', '[[78.35156809621168, 17.445565496370946], [78.3510818505751, 17.445402935739253], [78.34871393327182, 17.44297366973413]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000007'::uuid, 'PH3 → BLOCK B', '#00b4d8', '[[78.3486649229556, 17.443007256799305], [78.34880425711145, 17.443140183708365], [78.34848826715137, 17.443396542473252]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000008'::uuid, 'PH3 → BLOCK A', '#00b4d8', '[[78.3484335287335, 17.44398521679085], [78.34908292542195, 17.44341553199783], [78.34880425711145, 17.443140183708365]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000009'::uuid, 'PH1 → PH4', '#00b4d8', '[[78.35159848364157, 17.44557532910399], [78.35095289614935, 17.44576982116662], [78.34859125482501, 17.447747056552885], [78.34890811607835, 17.448093307337402]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000010'::uuid, 'PH4 → BAKUL OHT', '#00b4d8', '[[78.34889099161575, 17.4481030150547], [78.34863663284784, 17.44782419439771], [78.34842828429481, 17.448006849815854]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000011'::uuid, 'PH4 → NWH Block C', '#00b4d8', '[[78.34863200557686, 17.447827892848082], [78.34798863298869, 17.44714473747763], [78.34746274583108, 17.44761440706972]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000012'::uuid, 'PH4 → NWH Block B', '#00b4d8', '[[78.34798944843249, 17.44714716987866], [78.34775073198728, 17.446898400205413], [78.3472021023727, 17.447350593243257]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000013'::uuid, 'PH4 → NWH Block A', '#00b4d8', '[[78.34774710095786, 17.44689799488779], [78.34744051382114, 17.44658242120913], [78.346897993527019, 17.44704423616315]]'::jsonb, NOW()),
('11111111-1111-1111-1111-000000000014'::uuid, 'PH1 → PH2', '#00b4d8', '[[78.34925227266547, 17.44607018219577], [78.34983216194138, 17.446702074561657]]'::jsonb, NOW());

-- ============================================================
-- INSERT BOREWELL PIPELINES (Red lines for bore water)
-- ============================================================
INSERT INTO pipelines (id, name, color, positions, created_at) VALUES
('22222222-2222-2222-2222-000000000001'::uuid, 'P5 → S1 (Bore)', '#d62828', '[[78.349013, 17.447797], [78.349042, 17.448091]]'::jsonb, NOW()),
('22222222-2222-2222-2222-000000000002'::uuid, 'P5 → S7 (Bore)', '#d62828', '[[78.349018, 17.447780], [78.349951, 17.446921], [78.349090, 17.445962]]'::jsonb, NOW()),
('22222222-2222-2222-2222-000000000003'::uuid, 'P8 → S2 (Bore)', '#d62828', '[[78.345291, 17.445120], [78.346206, 17.444911]]'::jsonb, NOW()),
('22222222-2222-2222-2222-000000000004'::uuid, 'P9 → S3 (Bore)', '#d62828', '[[78.346714, 17.446868], [78.346915, 17.446715], [78.346984, 17.446715]]'::jsonb, NOW()),
('22222222-2222-2222-2222-000000000005'::uuid, 'P10 → S5 (Bore)', '#d62828', '[[78.350157, 17.443927], [78.349693, 17.444322], [78.350068, 17.444701]]'::jsonb, NOW());

-- ============================================================
-- SUMMARY
-- ============================================================
-- Total Infrastructure Added:
-- - 4 Pump Houses
-- - 11 Sumps  
-- - 14 Overhead Tanks
-- - 12 IIIT Borewells
-- - 7 Government Borewells
-- - 19 Pipelines (14 water supply + 5 borewell)
-- ============================================================
