import { getDbMode } from '@/lib/config';
import { createJob } from '@/lib/db/repository';
import { ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { processWorkerTick } from '@/lib/server/ingestion';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const job = await createJob('manual');
  if (getDbMode() === 'pglite') void processWorkerTick('manual-api').catch((err) => console.error('manual worker tick failed', err));
  return ok({ job }, { status: 202 });
}
