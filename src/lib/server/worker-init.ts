import { getDbMode } from '@/lib/config';

const globalWorker = globalThis as unknown as { __wlhWorkerStarted?: boolean };

/**
 * Local/preview convenience: start the in-process worker from Node.js API routes.
 * Production Supabase deployments should run `npm run worker` as a dedicated process.
 * This avoids pulling Node-only DB drivers into Next.js edge/middleware bundles.
 */
export function ensureInProcessWorker() {
  if (globalWorker.__wlhWorkerStarted) return;
  globalWorker.__wlhWorkerStarted = true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (getDbMode() !== 'pglite' || process.env.DISABLE_IN_PROCESS_WORKER === 'true') return;
  import('@/worker/loop')
    .then(({ startWorkerLoop }) => startWorkerLoop({ owner: `next-api-${process.pid}` }))
    .catch((err) => console.error('[worker-init] failed to start in-process worker', err));
}
