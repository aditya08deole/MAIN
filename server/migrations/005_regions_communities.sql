-- ============================================================================
-- MIGRATION 005: REGIONS AND COMMUNITIES TABLES
-- ============================================================================
-- Purpose: Add hierarchical structure for regions and communities
-- Author: System Architect
-- Date: 2026-02-21
-- Requirements: Support for multi-region community management
-- ============================================================================

-- Step 1: Create regions table
CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create communities table
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, region_id)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_regions_name ON regions(name);
CREATE INDEX IF NOT EXISTS idx_communities_region_id ON communities(region_id);
CREATE INDEX IF NOT EXISTS idx_communities_name ON communities(name);

-- Step 4: Add community_id to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_community_id ON users(community_id);

-- Step 5: Add community_id to devices table
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_community_id ON devices(community_id);

-- Step 6: Enhance devices table with required fields
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS physical_category TEXT,
ADD COLUMN IF NOT EXISTS analytics_template TEXT,
ADD COLUMN IF NOT EXISTS thingspeak_write_key TEXT;

-- Add constraint for device_type
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'devices_device_type_check'
    ) THEN
        ALTER TABLE devices 
        ADD CONSTRAINT devices_device_type_check 
        CHECK (device_type IN ('tank', 'deep', 'flow', 'pump', 'sump', 'bore', 'govt', NULL));
    END IF;
END $$;

-- Add constraint for analytics_template
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'devices_analytics_template_check'
    ) THEN
        ALTER TABLE devices 
        ADD CONSTRAINT devices_analytics_template_check 
        CHECK (analytics_template IN ('EvaraTank', 'EvaraDeep', 'EvaraFlow', NULL));
    END IF;
END $$;

-- Step 7: Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create triggers
DROP TRIGGER IF EXISTS regions_updated_at_trigger ON regions;
CREATE TRIGGER regions_updated_at_trigger
    BEFORE UPDATE ON regions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS communities_updated_at_trigger ON communities;
CREATE TRIGGER communities_updated_at_trigger
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Step 9: Seed major Indian cities as regions
INSERT INTO regions (name, state) VALUES
    ('Mumbai', 'Maharashtra'),
    ('Delhi', 'Delhi'),
    ('Bangalore', 'Karnataka'),
    ('Hyderabad', 'Telangana'),
    ('Ahmedabad', 'Gujarat'),
    ('Chennai', 'Tamil Nadu'),
    ('Kolkata', 'West Bengal'),
    ('Pune', 'Maharashtra'),
    ('Jaipur', 'Rajasthan'),
    ('Surat', 'Gujarat'),
    ('Lucknow', 'Uttar Pradesh'),
    ('Kanpur', 'Uttar Pradesh'),
    ('Nagpur', 'Maharashtra'),
    ('Indore', 'Madhya Pradesh'),
    ('Thane', 'Maharashtra'),
    ('Bhopal', 'Madhya Pradesh'),
    ('Visakhapatnam', 'Andhra Pradesh'),
    ('Pimpri-Chinchwad', 'Maharashtra'),
    ('Patna', 'Bihar'),
    ('Vadodara', 'Gujarat')
ON CONFLICT (name) DO NOTHING;

-- Step 10: Add helpful comments
COMMENT ON TABLE regions IS 'Geographic regions (cities) for organizing communities';
COMMENT ON TABLE communities IS 'Communities within regions where devices are deployed';
COMMENT ON COLUMN devices.device_type IS 'Device category: tank, deep, flow, pump, sump, bore, govt';
COMMENT ON COLUMN devices.analytics_template IS 'Analytics page template: EvaraTank, EvaraDeep, EvaraFlow';
COMMENT ON COLUMN devices.physical_category IS 'Physical classification for display purposes';
COMMENT ON COLUMN devices.community_id IS 'Community where device is deployed';

-- Step 11: Performance validation
DO $$
DECLARE
    region_count INTEGER;
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO region_count FROM regions;
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename IN ('regions', 'communities');
    
    RAISE NOTICE 'Migration 005 Complete:';
    RAISE NOTICE '  - Total regions: %', region_count;
    RAISE NOTICE '  - Total indexes: %', index_count;
    RAISE NOTICE '  - Status: READY FOR HIERARCHICAL MANAGEMENT';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
