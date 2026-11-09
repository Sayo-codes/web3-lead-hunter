import { processWorkerTick } from '@/lib/server/ingestion';

const globalWorker = globalThis as unknown as { __wlhWorkerTimer?: ReturnType<typeof setInterval> | null; __wlhWorkerRunning?: boolean };
let running = false;

export function startWorkerLoop(opts: { pollSeconds?: number; owner?: string } = {}) {
  if (globalWorker.__wlhWorkerTimer) return;
  const pollSeconds = opts.pollSeconds ?? Number(process.env.WORKER_POLL_SECONDS || 15);
  const owner = opts.owner ?? `worker-${process.pid}`;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const res = await processWorkerTick(owner);
      if (res.ran) console.log(`[worker] completed discovery job ${res.jobId}`);
      else if (process.env.LOG_LEVEL === 'debug') console.log('[worker] no job due or lock busy');
    } catch (err) {
      console.error('[worker] tick failed', err);
    } finally {
      running = false;
    }
  };
  // Run immediately, then poll.
  void tick();
  globalWorker.__wlhWorkerTimer = setInterval(tick, Math.max(5, pollSeconds) * 1000);
  console.log(`[worker] started (poll every ${pollSeconds}s, owner ${owner})`);
}

export function stopWorkerLoop() {
  if (globalWorker.__wlhWorkerTimer) clearInterval(globalWorker.__wlhWorkerTimer);
  globalWorker.__wlhWorkerTimer = null;
}
