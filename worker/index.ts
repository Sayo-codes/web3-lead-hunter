async function main() {
  await import('tsconfig-paths/register');
  const { startWorkerLoop, stopWorkerLoop } = await import('../src/worker/loop');
  const { getDbMode } = await import('../src/lib/config');
  const mode = getDbMode();
  if (mode === 'pglite') {
    console.warn('[worker] DB_MODE=pglite. For local dev the worker usually runs inside Next.js. Standalone PGlite worker is only safe when DISABLE_IN_PROCESS_WORKER=true and no other process uses the same data dir.');
  }
  startWorkerLoop({ owner: `standalone-${process.pid}`, workerMode: 'standalone' });
  const shutdown = async () => {
    console.log('[worker] shutdown signal received...');
    await stopWorkerLoop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => { console.error(err); process.exit(1); });

export {};
