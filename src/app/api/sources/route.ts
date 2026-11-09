import { getApiSources, setSourceEnabled } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  return ok(await getApiSources());
}
export async function PATCH(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.id || typeof body.enabled !== 'boolean') return fail('id and enabled required');
  await setSourceEnabled(body.id, body.enabled);
  return ok(await getApiSources());
}
