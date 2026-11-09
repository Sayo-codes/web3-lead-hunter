import { getWorkerHealth } from '@/lib/db/repository';
import { ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const health = await getWorkerHealth();
  return ok(health);
}

