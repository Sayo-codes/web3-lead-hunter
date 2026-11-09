import { getStats } from '@/lib/db/repository';
import { ok, fail } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  try { return ok(await getStats()); } catch (e) { return fail(e instanceof Error ? e.message : 'Failed to load stats', 500); }
}
