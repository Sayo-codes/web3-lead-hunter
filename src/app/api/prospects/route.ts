import type { NextRequest } from 'next/server';
import { listProspects, saveProspect } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  return ok(await listProspects({ status: sp.get('status') || undefined, opportunity: sp.get('opportunity') || undefined, search: sp.get('search') || undefined }));
}
export async function POST(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.projectId) return fail('projectId required');
  return ok(await saveProspect(body.projectId));
}
