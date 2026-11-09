import { createTemplate, listTemplates } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { templateSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  return ok(await listTemplates());
}
export async function POST(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const parsed = templateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid template', 422, { issues: parsed.error.flatten() });
  return ok(await createTemplate(parsed.data), { status: 201 });
}
