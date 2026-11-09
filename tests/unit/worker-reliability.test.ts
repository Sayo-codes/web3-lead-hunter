import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// In-memory test DB to simulate PostgreSQL / PGlite
let db: PGlite;

describe('Worker Reliability, Heartbeats, and Distributed Lock Management', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.waitReady;
    const dir = path.join(process.cwd(), 'supabase/migrations');
    await db.exec(await fs.readFile(path.join(dir, '202611080001_core.sql'), 'utf8'));
    await db.exec(await fs.readFile(path.join(dir, '202611080002_seed.sql'), 'utf8'));
    await db.exec(await fs.readFile(path.join(dir, '202611090001_worker_reliability.sql'), 'utf8'));
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it('1. Worker startup: registers heartbeat and starts in idle status', async () => {
    const workerId = 'test-worker-1';
    await db.query(
      `INSERT INTO worker_heartbeats (worker_id, worker_mode, status, last_heartbeat_at)
       VALUES ($1, 'in_process', 'idle', now())
       ON CONFLICT (worker_id) DO UPDATE SET status = EXCLUDED.status, last_heartbeat_at = now()`,
      [workerId],
    );

    const rows = await db.query<any>(`SELECT * FROM worker_heartbeats WHERE worker_id = $1`, [workerId]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe('idle');
    expect(rows.rows[0].worker_mode).toBe('in_process');
  });

  it('2. Duplicate worker prevention: worker_locks allows only one owner at a time', async () => {
    const lockId = 'discovery';
    const owner1 = 'worker-alpha';
    const owner2 = 'worker-beta';

    // Worker 1 acquires lock for 60 seconds
    const acq1 = await db.query(
      `INSERT INTO worker_locks (id, locked_until, locked_by, updated_at)
       VALUES ($1, now() + (60 * interval '1 second'), $2, now())
       ON CONFLICT (id) DO UPDATE SET
         locked_until = EXCLUDED.locked_until,
         locked_by = EXCLUDED.locked_by,
         updated_at = now()
       WHERE worker_locks.locked_until < now() OR worker_locks.locked_by = EXCLUDED.locked_by
       RETURNING id`,
      [lockId, owner1],
    );
    expect(acq1.rows).toHaveLength(1);

    // Worker 2 attempts to acquire the active lock -> must fail
    const acq2 = await db.query(
      `INSERT INTO worker_locks (id, locked_until, locked_by, updated_at)
       VALUES ($1, now() + (60 * interval '1 second'), $2, now())
       ON CONFLICT (id) DO UPDATE SET
         locked_until = EXCLUDED.locked_until,
         locked_by = EXCLUDED.locked_by,
         updated_at = now()
       WHERE worker_locks.locked_until < now() OR worker_locks.locked_by = EXCLUDED.locked_by
       RETURNING id`,
      [lockId, owner2],
    );
    expect(acq2.rows).toHaveLength(0);

    // Verify Worker 1 still owns the lock
    const current = await db.query<any>(`SELECT * FROM worker_locks WHERE id = $1`, [lockId]);
    expect(current.rows[0].locked_by).toBe(owner1);
  });

  it('3. Manual discovery triggering: creates job in queued status with trigger_source = manual', async () => {
    const res = await db.query<any>(
      `INSERT INTO discovery_jobs (status, trigger_source) VALUES ('queued', 'manual') RETURNING *`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].status).toBe('queued');
    expect(res.rows[0].trigger_source).toBe('manual');
    expect(res.rows[0].retry_count).toBe(0);
  });

  it('4. Production job processing: atomic claimQueuedJob claims queued job exclusively', async () => {
    const workerOwner = 'worker-prod-1';

    // Claim the queued job atomically
    const claim = await db.query<any>(
      `UPDATE discovery_jobs
       SET status = 'running', started_at = now(), locked_by = $1, heartbeat_at = now()
       WHERE id = (
         SELECT id FROM discovery_jobs
         WHERE status = 'queued'
         ORDER BY created_at ASC
         LIMIT 1
       )
       RETURNING *`,
      [workerOwner],
    );
    expect(claim.rows).toHaveLength(1);
    expect(claim.rows[0].status).toBe('running');
    expect(claim.rows[0].locked_by).toBe(workerOwner);
    expect(claim.rows[0].heartbeat_at).not.toBeNull();

    // A second worker attempting to claim should find no queued job
    const secondClaim = await db.query<any>(
      `UPDATE discovery_jobs
       SET status = 'running', started_at = now(), locked_by = $1, heartbeat_at = now()
       WHERE id = (
         SELECT id FROM discovery_jobs
         WHERE status = 'queued'
         ORDER BY created_at ASC
         LIMIT 1
       )
       RETURNING *`,
      ['worker-prod-2'],
    );
    expect(secondClaim.rows).toHaveLength(0);
  });

  it('5. Worker heartbeat: updates last_heartbeat_at and status correctly', async () => {
    const workerId = 'worker-prod-1';
    await db.query(
      `INSERT INTO worker_heartbeats (worker_id, worker_mode, status, current_job_id, last_heartbeat_at)
       VALUES ($1, 'standalone', 'processing', NULL, now())
       ON CONFLICT (worker_id) DO UPDATE SET
         status = EXCLUDED.status,
         last_heartbeat_at = now(),
         updated_at = now()`,
      [workerId],
    );

    const row = await db.query<any>(`SELECT * FROM worker_heartbeats WHERE worker_id = $1`, [workerId]);
    expect(row.rows[0].status).toBe('processing');
    expect(row.rows[0].worker_mode).toBe('standalone');
  });

  it('6. Lock renewal: owner can renew lock, but a non-owner cannot', async () => {
    const lockId = 'discovery';
    const owner = 'worker-alpha';
    const imposter = 'worker-charlie';

    // Owner renews lock for another 60s
    const renew1 = await db.query(
      `UPDATE worker_locks
       SET locked_until = now() + (60 * interval '1 second'), updated_at = now()
       WHERE id = $1 AND locked_by = $2
       RETURNING id`,
      [lockId, owner],
    );
    expect(renew1.rows).toHaveLength(1);

    // Imposter attempts to renew -> must fail
    const renew2 = await db.query(
      `UPDATE worker_locks
       SET locked_until = now() + (60 * interval '1 second'), updated_at = now()
       WHERE id = $1 AND locked_by = $2
       RETURNING id`,
      [lockId, imposter],
    );
    expect(renew2.rows).toHaveLength(0);
  });

  it('7. Stale-lock recovery: expired lock can be taken over by another worker', async () => {
    const lockId = 'discovery';
    const newOwner = 'worker-delta';

    // Force expire the lock
    await db.query(
      `UPDATE worker_locks SET locked_until = now() - interval '10 seconds' WHERE id = $1`,
      [lockId],
    );

    // New worker acquires the expired lock
    const acq = await db.query(
      `INSERT INTO worker_locks (id, locked_until, locked_by, updated_at)
       VALUES ($1, now() + (60 * interval '1 second'), $2, now())
       ON CONFLICT (id) DO UPDATE SET
         locked_until = EXCLUDED.locked_until,
         locked_by = EXCLUDED.locked_by,
         updated_at = now()
       WHERE worker_locks.locked_until < now() OR worker_locks.locked_by = EXCLUDED.locked_by
       RETURNING id`,
      [lockId, newOwner],
    );
    expect(acq.rows).toHaveLength(1);

    const lock = await db.query<any>(`SELECT * FROM worker_locks WHERE id = $1`, [lockId]);
    expect(lock.rows[0].locked_by).toBe(newOwner);
  });

  it('8. Worker crash recovery: re-queues abandoned jobs with retry count incremented', async () => {
    // Insert a running job with an expired heartbeat (simulating a crashed worker)
    const crashedJob = await db.query<any>(
      `INSERT INTO discovery_jobs (status, trigger_source, locked_by, heartbeat_at, retry_count, max_retries)
       VALUES ('running', 'scheduled', 'crashed-worker', now() - interval '5 minutes', 0, 3)
       RETURNING id`,
    );
    const jobId = crashedJob.rows[0].id;

    // Simulate recoverStaleJobs logic
    const stale = await db.query<any>(
      `SELECT * FROM discovery_jobs
       WHERE status = 'running'
         AND (
           (heartbeat_at IS NOT NULL AND heartbeat_at < now() - (120 * interval '1 second'))
           OR (heartbeat_at IS NULL AND started_at < now() - (120 * interval '1 second'))
         )`,
    );
    expect(stale.rows.some((j: any) => j.id === jobId)).toBe(true);

    // Re-queue the job
    await db.query(
      `UPDATE discovery_jobs
       SET status = 'queued',
           retry_count = retry_count + 1,
           locked_by = NULL,
           heartbeat_at = NULL
       WHERE id = $1`,
      [jobId],
    );

    const recovered = await db.query<any>(`SELECT * FROM discovery_jobs WHERE id = $1`, [jobId]);
    expect(recovered.rows[0].status).toBe('queued');
    expect(recovered.rows[0].retry_count).toBe(1);
    expect(recovered.rows[0].locked_by).toBeNull();
  });

  it('9. Duplicate job prevention: stops retrying when max_retries is reached', async () => {
    // Insert a running job that has already exhausted max_retries
    const exhaustedJob = await db.query<any>(
      `INSERT INTO discovery_jobs (status, trigger_source, locked_by, heartbeat_at, retry_count, max_retries)
       VALUES ('running', 'scheduled', 'crashed-worker-2', now() - interval '5 minutes', 3, 3)
       RETURNING id`,
    );
    const jobId = exhaustedJob.rows[0].id;

    // Simulate recovery check
    const row = await db.query<any>(`SELECT * FROM discovery_jobs WHERE id = $1`, [jobId]);
    const job = row.rows[0];
    if (job.retry_count >= job.max_retries) {
      await db.query(
        `UPDATE discovery_jobs
         SET status = 'failed',
             finished_at = now(),
             locked_by = NULL,
             error = 'Exceeded maximum retries after worker heartbeat timeout'
         WHERE id = $1`,
        [jobId],
      );
    }

    const failed = await db.query<any>(`SELECT * FROM discovery_jobs WHERE id = $1`, [jobId]);
    expect(failed.rows[0].status).toBe('failed');
    expect(failed.rows[0].error).toContain('Exceeded maximum retries');
  });

  it('10. Graceful shutdown: releases lock and marks worker stopped', async () => {
    const lockId = 'discovery';
    const workerOwner = 'worker-delta';

    // Release lock owned by worker-delta
    const rel = await db.query(
      `UPDATE worker_locks
       SET locked_until = now(), updated_at = now()
       WHERE id = $1 AND ($2::text IS NULL OR locked_by = $2 OR locked_until < now())
       RETURNING id`,
      [lockId, workerOwner],
    );
    expect(rel.rows).toHaveLength(1);

    // Worker marks itself stopped
    await db.query(
      `UPDATE worker_heartbeats SET status = 'stopped', last_heartbeat_at = now(), current_job_id = NULL WHERE worker_id = $1`,
      ['worker-prod-1'],
    );
    const w = await db.query<any>(`SELECT * FROM worker_heartbeats WHERE worker_id = $1`, ['worker-prod-1']);
    expect(w.rows[0].status).toBe('stopped');
  });
});

