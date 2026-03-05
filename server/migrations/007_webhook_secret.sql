-- Phase 22: Add webhook_secret column to devices table
-- This enables per-device push mode (ThingSpeak React or external webhook push)

ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

COMMENT ON COLUMN devices.webhook_secret IS
    'HMAC-SHA256 secret for webhook payload verification. '
    'When set, the background ingestion loop skips polling for this device (Phase 23 hybrid mode).';
