-- Worker reliability, heartbeats, and atomic job locking.
-- Supports both Supabase PostgreSQL and local PGlite.

-- 1. Extend discovery_jobs with lock ownership, heartbeats, and retry bounds
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
ALTER TABLE discovery_jobs ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;

-- 2. Worker heartbeats table for active worker monitoring
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id text PRIMARY KEY,
  worker_mode text NOT NULL DEFAULT 'standalone' CHECK (worker_mode IN ('in_process', 'standalone')),
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'processing', 'stopping', 'stopped')),
  current_job_id uuid REFERENCES discovery_jobs(id) ON DELETE SET NULL,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last ON worker_heartbeats(last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_status ON worker_heartbeats(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_heartbeat ON discovery_jobs(status, heartbeat_at);

