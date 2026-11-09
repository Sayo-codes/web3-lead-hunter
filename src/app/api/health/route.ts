import { getDb } from '@/lib/db';
import { getServerConfig } from '@/lib/config';
import { getWorkerHealth } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { ensureInProcessWorker } from '@/lib/server/worker-init';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  ensureInProcessWorker();
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    const worker = await getWorkerHealth();
    return ok({
      status: 'ok',
      mode: db.mode,
      worker_status: worker.status,
      active_workers: worker.active_workers,
      queued_jobs: worker.queued_jobs_count,
      config: getServerConfig(),
      time: new Date().toISOString(),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
