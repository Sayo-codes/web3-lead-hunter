import { getProject, setProjectReviewStatus } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { reviewSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return fail('Project not found', 404);
  return ok(project);
}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return fail('Invalid review status', 422, { issues: parsed.error.flatten() });
  await setProjectReviewStatus(id, parsed.data.status);
  return ok(await getProject(id));
}
