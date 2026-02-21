-- ============================================================================
-- MIGRATION 003: DEVICES TABLE UPGRADE FOR MAP IMPLEMENTATION
-- ============================================================================
-- Purpose: Upgrade devices table to support dynamic map rendering
-- Author: System Architect
-- Date: 2026-02-21
-- Requirements: Production-grade map system with geographic indexing
-- ============================================================================

-- Step 1: Add new columns to existing devices table
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS asset_type TEXT,
ADD COLUMN IF NOT EXISTS asset_category TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS capacity TEXT,
ADD COLUMN IF NOT EXISTS specifications TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 2: Migrate existing lat/lng to new columns if they have different names
UPDATE devices 
SET latitude = lat, longitude = lng 
WHERE latitude IS NULL AND lat IS NOT NULL;

-- Step 3: Add CHECK constraint for status values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'devices_status_check'
    ) THEN
        ALTER TABLE devices 
        ADD CONSTRAINT devices_status_check 
        CHECK (status IN ('Working', 'Not Working', 'Normal', 'Running', 'Critical', 'active', 'inactive', 'maintenance'));
    END IF;
END $$;

-- Step 4: Add CHECK constraint for asset_type values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'devices_asset_type_check'
    ) THEN
        ALTER TABLE devices 
        ADD CONSTRAINT devices_asset_type_check 
        CHECK (asset_type IN ('pump', 'sump', 'tank', 'bore', 'govt', 'pipeline', 'sensor', NULL));
    END IF;
END $$;

-- Step 5: Create indexes for optimized map queries
-- These indexes ensure sub-200ms query performance

-- Index on asset_type for filtering by device type
CREATE INDEX IF NOT EXISTS idx_devices_asset_type ON devices(asset_type) 
WHERE asset_type IS NOT NULL;

-- Index on status for filtering working/non-working devices
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status) 
WHERE status IS NOT NULL;

-- Index on is_active for filtering active devices only
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(is_active) 
WHERE is_active = TRUE;

-- Composite index on latitude/longitude for geographic queries
CREATE INDEX IF NOT EXISTS idx_devices_lat_lng ON devices(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Partial index for active map devices (most common query)
CREATE INDEX IF NOT EXISTS idx_devices_map_active ON devices(id, name, asset_type, latitude, longitude, status) 
WHERE is_active = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index on user_id for user-specific queries (already exists but verify)
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON devices(created_at DESC);

-- Step 6: Add helpful comments to columns
COMMENT ON COLUMN devices.name IS 'Display name of the device (e.g., Pump House 1, Borewell P5)';
COMMENT ON COLUMN devices.asset_type IS 'Type of asset: pump, sump, tank, bore, govt, pipeline, sensor';
COMMENT ON COLUMN devices.asset_category IS 'Subcategory for grouping (e.g., Primary Hub, IIIT Bore, OHT Pair)';
COMMENT ON COLUMN devices.latitude IS 'Geographic latitude for map display';
COMMENT ON COLUMN devices.longitude IS 'Geographic longitude for map display';
COMMENT ON COLUMN devices.capacity IS 'Device capacity specification (e.g., 4.98L L, 5 HP)';
COMMENT ON COLUMN devices.specifications IS 'Additional technical specifications';
COMMENT ON COLUMN devices.status IS 'Device operational status: Working, Not Working, Normal, Running, Critical';
COMMENT ON COLUMN devices.is_active IS 'Whether device is active and should be displayed on maps';

-- Step 7: Create function to update timestamp automatically
CREATE OR REPLACE FUNCTION update_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS devices_updated_at_trigger ON devices;
CREATE TRIGGER devices_updated_at_trigger
    BEFORE UPDATE ON devices
    FOR EACH ROW
    EXECUTE FUNCTION update_devices_updated_at();

-- Step 9: Verify index usage with EXPLAIN (for documentation)
-- Run this manually to verify:
-- EXPLAIN ANALYZE 
-- SELECT id, name, asset_type, latitude, longitude, status 
-- FROM devices 
-- WHERE is_active = TRUE AND latitude IS NOT NULL;

-- Step 10: Performance validation
DO $$
DECLARE
    device_count INTEGER;
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO device_count FROM devices;
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename = 'devices';
    
    RAISE NOTICE 'Migration 003 Complete:';
    RAISE NOTICE '  - Total devices: %', device_count;
    RAISE NOTICE '  - Total indexes: %', index_count;
    RAISE NOTICE '  - Status: READY FOR MAP RENDERING';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run migration: psql -f 003_devices_map_upgrade.sql
-- 2. Seed data: Run seed script to populate devices
-- 3. Verify indexes: \di devices*
-- 4. Test query performance: Should be < 200ms
-- ============================================================================
