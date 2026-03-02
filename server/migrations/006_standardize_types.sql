-- Migration: Standardize is_active types to BOOLEAN
-- Affected Table: devices

BEGIN;

-- 1. Create a temporary column
ALTER TABLE devices ADD COLUMN is_active_new BOOLEAN DEFAULT TRUE;

-- 2. Migrate data
UPDATE devices SET is_active_new = (is_active = 'true');

-- 3. Remove old column and rename new one
ALTER TABLE devices DROP COLUMN is_active;
ALTER TABLE devices RENAME COLUMN is_active_new TO is_active;

-- 4. Re-create index for the new column
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(is_active);

COMMIT;
