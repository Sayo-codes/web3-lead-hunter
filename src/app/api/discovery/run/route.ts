import { getDbMode } from '@/lib/config';
import { createJob, getJob, getWorkerHealth } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { processWorkerTick } from '@/lib/server/ingestion';
import { sleep } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (jobId) {
    const job = await getJob(jobId);
    if (!job) return fail('Job not found', 404);
    return ok({ job });
  }

  const workerHealth = await getWorkerHealth();
  return ok({ workerHealth });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: { wait?: boolean; timeoutMs?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dbMode = getDbMode();
  const initialHealth = await getWorkerHealth();

  // If running in Supabase production mode without an active standalone worker process
  if (dbMode === 'supabase' && initialHealth.active_workers === 0) {
    const job = await createJob('manual');
    return ok(
      {
        job,
        status: 'worker_unavailable',
        active_workers: 0,
        message: 'No active background worker detected. The job was created in "queued" status, but requires a dedicated worker process (npm run worker) to execute in Supabase mode.',
      },
      { status: 503 },
    );
  }

  // Create the manual discovery job
  const job = await createJob('manual');

  // In local PGlite mode, immediately trigger an in-process tick to ensure the job runs
  if (dbMode === 'pglite') {
    void processWorkerTick('manual-api').catch((err) =>
      console.error('[discovery-run] manual tick failed', err),
    );
  }

  // Default wait duration is up to 6 seconds to observe initial pickup or completion
  const shouldWait = body.wait !== false;
  const timeoutMs = Math.min(Math.max(1000, body.timeoutMs ?? 6000), 30000);

  if (!shouldWait) {
    return ok(
      {
        job,
        status: 'queued',
        message: 'Discovery job queued successfully for worker processing.',
      },
      { status: 202 },
    );
  }

  // Observe the job's transition
  const startTime = Date.now();
  let currentJob = job;

  while (Date.now() - startTime < timeoutMs) {
    await sleep(400);
    const updated = await getJob(job.id);
    if (updated) {
      currentJob = updated;
      if (updated.status === 'completed' || updated.status === 'completed_with_errors') {
        return ok({
          job: updated,
          status: updated.status,
          message: `Discovery finished with ${updated.projects_created} new projects created and ${updated.projects_updated} refreshed.`,
        });
      }
      if (updated.status === 'failed') {
        return ok(
          {
            job: updated,
            status: 'failed',
            message: updated.error || 'Discovery job failed.',
          },
          { status: 500 },
        );
      }
      if (updated.status === 'running') {
        // Job has been claimed and is actively processing
        return ok(
          {
            job: updated,
            status: 'running',
            message: 'Discovery job is actively running.',
          },
          { status: 202 },
        );
      }
    }
  }

  // If the timeout elapsed and the job is still queued
  const finalHealth = await getWorkerHealth();
  if (finalHealth.active_workers === 0 && dbMode === 'supabase') {
    return ok(
      {
        job: currentJob,
        status: 'worker_unavailable',
        message: 'Job was queued, but no worker picked it up within the timeout. Please verify that the worker container is running.',
      },
      { status: 504 },
    );
  }

  return ok(
    {
      job: currentJob,
      status: currentJob.status,
      message: 'Job is queued in the worker queue and will process shortly.',
    },
    { status: 202 },
  );
}
