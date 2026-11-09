import { getDb } from '@/lib/db';
import { getServerConfig } from '@/lib/config';
import { fail, ok } from '@/lib/server/api';
import { ensureInProcessWorker } from '@/lib/server/worker-init';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  ensureInProcessWorker();
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    return ok({ status: 'ok', mode: db.mode, config: getServerConfig(), time: new Date().toISOString() });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Database unavailable', 503);
  }
}
