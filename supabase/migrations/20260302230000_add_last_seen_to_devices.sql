-- Add last_seen column to devices for telemetry freshness tracking
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Index for efficient freshness queries
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices(last_seen);

-- Back-fill from telemetry_snapshots where available
UPDATE public.devices d
SET last_seen = ts.last_timestamp
FROM public.telemetry_snapshots ts
WHERE ts.device_id = d.id
  AND d.last_seen IS NULL;
