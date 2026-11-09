import { deleteProspect, updateProspect } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { prospectPatchSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = prospectPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid prospect payload', 422, { issues: parsed.error.flatten() });
  const prospect = await updateProspect(id, parsed.data);
  if (!prospect) return fail('Prospect not found', 404);
  return ok(prospect);
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const deleted = await deleteProspect(id);
  if (!deleted) return fail('Prospect not found', 404);
  return ok({ deleted: true });
}
