import { getProject, saveProspect } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return fail('Project not found', 404);
  const prospect = await saveProspect(id);
  return ok({ prospect, project: await getProject(id) });
}
