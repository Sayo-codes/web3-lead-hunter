import { clearWorkerHeartbeat, recordWorkerHeartbeat, releaseLock } from '@/lib/db/repository';
import { processWorkerTick } from '@/lib/server/ingestion';

interface WorkerState {
  timer: ReturnType<typeof setInterval> | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  running: boolean;
  owner: string | null;
  workerMode: 'in_process' | 'standalone';
}

const globalWorker = globalThis as unknown as { __wlhWorkerState?: WorkerState };

function getWorkerState(): WorkerState {
  if (!globalWorker.__wlhWorkerState) {
    globalWorker.__wlhWorkerState = {
      timer: null,
      heartbeatTimer: null,
      running: false,
      owner: null,
      workerMode: 'in_process',
    };
  }
  return globalWorker.__wlhWorkerState;
}

export function startWorkerLoop(opts: {
  pollSeconds?: number;
  owner?: string;
  workerMode?: 'in_process' | 'standalone';
} = {}) {
  const state = getWorkerState();
  if (state.timer) return;

  const pollSeconds = opts.pollSeconds ?? Number(process.env.WORKER_POLL_SECONDS || 15);
  const workerMode = opts.workerMode ?? (opts.owner?.startsWith('standalone') ? 'standalone' : 'in_process');
  const owner = opts.owner ?? `${workerMode}-${process.pid}`;

  state.owner = owner;
  state.workerMode = workerMode;

  // Send initial heartbeat
  void recordWorkerHeartbeat(owner, {
    worker_mode: workerMode,
    status: 'idle',
    metadata: { pid: process.pid, pollSeconds },
  }).catch((err) => console.error('[worker] initial heartbeat failed', err));

  // Periodic heartbeat every 15s even when idle
  state.heartbeatTimer = setInterval(() => {
    void recordWorkerHeartbeat(owner, {
      worker_mode: workerMode,
      status: state.running ? 'processing' : 'idle',
      metadata: { pid: process.pid, pollSeconds },
    }).catch(() => {});
  }, 15000);

  const tick = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const res = await processWorkerTick(owner);
      if (res.ran) {
        console.log(`[worker] completed discovery job ${res.jobId}`);
      } else if (process.env.LOG_LEVEL === 'debug') {
        console.log(`[worker] tick: ${res.reason || 'idle'}`);
      }
    } catch (err) {
      console.error('[worker] tick failed', err);
      void recordWorkerHeartbeat(owner, {
        last_error: err instanceof Error ? err.message : 'tick failed',
      }).catch(() => {});
    } finally {
      state.running = false;
    }
  };

  // Run immediately, then poll
  void tick();
  state.timer = setInterval(tick, Math.max(5, pollSeconds) * 1000);
  console.log(`[worker] started (${workerMode}, poll every ${pollSeconds}s, owner ${owner})`);

  // Register graceful exit handlers once
  const shutdown = async () => {
    await stopWorkerLoop();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export async function stopWorkerLoop(): Promise<void> {
  const state = getWorkerState();
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  if (state.owner) {
    const owner = state.owner;
    try {
      await clearWorkerHeartbeat(owner);
      await releaseLock('discovery', owner);
    } catch (err) {
      console.error('[worker] cleanup failed on stop', err);
    }
    state.owner = null;
  }
  console.log('[worker] stopped');
}
