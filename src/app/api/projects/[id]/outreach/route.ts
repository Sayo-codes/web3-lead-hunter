import { getProject, getSettings, recordOutreach } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { outreachSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = outreachSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid outreach payload', 422, { issues: parsed.error.flatten() });
  const project = await getProject(id);
  if (!project) return fail('Project not found', 404);
  const settings = await getSettings();
  const result = await recordOutreach(id, parsed.data, settings.duplicate_contact_window_hours);
  if (result.duplicate) return fail('Duplicate contact protection: this project was already contacted within the configured window.', 409, { last: result.last });
  return ok({ history: result.history, project: await getProject(id) });
}
