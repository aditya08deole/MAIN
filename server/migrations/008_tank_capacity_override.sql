-- Phase 26: Add capacity_override_liters to device_config_tank
-- Allows operators to override the dimension-derived capacity with an exact value.

ALTER TABLE device_config_tank
    ADD COLUMN IF NOT EXISTS capacity_override_liters FLOAT;

COMMENT ON COLUMN device_config_tank.capacity_override_liters IS
    'Optional: if set, overrides the dimension-calculated capacity in liters. '
    'Leave NULL to use geometry-based calculation.';
