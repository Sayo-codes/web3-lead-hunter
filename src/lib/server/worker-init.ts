import { getDbMode } from '@/lib/config';

const globalWorker = globalThis as unknown as {
  __wlhWorkerStarted?: boolean;
  __wlhWorkerStopping?: boolean;
};

/**
 * Local/preview convenience: start the in-process worker reliably.
 * Production Supabase deployments run `npm run worker` as a dedicated process.
 * This avoids pulling Node-only DB drivers into Next.js edge/middleware bundles.
 */
export function ensureInProcessWorker(): boolean {
  if (globalWorker.__wlhWorkerStarted) return false;
  if (process.env.NEXT_PHASE === 'phase-production-build') return false;

  const mode = getDbMode();
  if (mode !== 'pglite' || process.env.DISABLE_IN_PROCESS_WORKER === 'true') {
    return false;
  }

  globalWorker.__wlhWorkerStarted = true;
  import('@/worker/loop')
    .then(({ startWorkerLoop }) =>
      startWorkerLoop({ owner: `in-process-${process.pid}`, workerMode: 'in_process' }),
    )
    .catch((err) => {
      globalWorker.__wlhWorkerStarted = false;
      console.error('[worker-init] failed to start in-process worker', err);
    });

  return true;
}

export async function stopInProcessWorker(): Promise<void> {
  if (!globalWorker.__wlhWorkerStarted) return;
  const { stopWorkerLoop } = await import('@/worker/loop');
  await stopWorkerLoop();
  globalWorker.__wlhWorkerStarted = false;
}
