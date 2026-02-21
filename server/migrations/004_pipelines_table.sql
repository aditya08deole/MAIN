-- Migration: Create pipelines table for map pipeline rendering
-- Date: 2026-02-21
-- Purpose: Store water supply and borewell pipeline data with geographic coordinates

-- Create pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    pipeline_type TEXT NOT NULL CHECK (pipeline_type IN ('water_supply', 'borewell_water')),
    
    -- Device relationships (optional - for traceability)
    -- Note: devices.id is VARCHAR, not UUID
    from_device_id VARCHAR(255) REFERENCES devices(id) ON DELETE SET NULL,
    to_device_id VARCHAR(255) REFERENCES devices(id) ON DELETE SET NULL,
    
    -- Geographic data: array of lat/lng pairs for polyline
    coordinates JSONB NOT NULL,
    
    -- Pipeline specifications
    diameter TEXT, -- e.g., "6 inch PVC", "2 inch GI"
    material TEXT, -- e.g., "PVC", "GI", "HDPE"
    installation_type TEXT, -- e.g., "Underground", "Surface", "Overhead"
    
    -- Visual properties
    color TEXT DEFAULT '#00b4d8',
    
    -- Status tracking
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Flowing', 'Blocked', 'Maintenance', 'Inactive')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_active ON pipelines(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pipelines_type ON pipelines(pipeline_type);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_from_device ON pipelines(from_device_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_to_device ON pipelines(to_device_id);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_pipelines_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pipelines_timestamp
    BEFORE UPDATE ON pipelines
    FOR EACH ROW
    EXECUTE FUNCTION update_pipelines_timestamp();

-- Add comments
COMMENT ON TABLE pipelines IS 'Water distribution pipelines with geographic coordinates for map visualization';
COMMENT ON COLUMN pipelines.coordinates IS 'Array of [lng, lat] pairs in GeoJSON format for polyline rendering';
COMMENT ON COLUMN pipelines.pipeline_type IS 'Type of pipeline: water_supply (from pump houses) or borewell_water (from borewells)';
COMMENT ON COLUMN pipelines.color IS 'Hex color code for map rendering (e.g., #00b4d8 for supply, #d62828 for borewell)';
