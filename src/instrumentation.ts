/**
 * Next.js Instrumentation Hook
 * Runs when Next.js server boots up (Node.js runtime).
 * Starts local in-process discovery worker automatically on server boot without waiting for requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureInProcessWorker } = await import('@/lib/server/worker-init');
    ensureInProcessWorker();
  }
}

