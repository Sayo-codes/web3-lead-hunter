import { deleteTemplate, updateTemplate } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { templateSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = templateSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid template', 422);
  const t = await updateTemplate(id, parsed.data);
  if (!t) return fail('Template not found', 404);
  return ok(t);
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  await deleteTemplate(id);
  return ok({ deleted: true });
}
