import type { NextRequest } from 'next/server';
import { listNotifications, markNotificationsRead } from '@/lib/db/repository';
import { boolParam, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const sp = req.nextUrl.searchParams;
  return ok(await listNotifications(Number(sp.get('limit') || 50), boolParam(sp.get('unread')) ?? false));
}
export async function POST(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  await markNotificationsRead(Array.isArray(body?.ids) ? body.ids : undefined);
  return ok({ read: true });
}
