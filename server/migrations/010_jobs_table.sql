-- 010_jobs_table.sql
-- Adds persistent jobs table for background processing

CREATE TABLE IF NOT EXISTS public.jobs (
    id text PRIMARY KEY,
    type text NOT NULL,
    payload jsonb,
    status text NOT NULL DEFAULT 'queued',
    result jsonb,
    error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    finished_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs (type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at);
