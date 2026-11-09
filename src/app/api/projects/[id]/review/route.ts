import { getProject, setProjectReviewStatus } from '@/lib/db/repository';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { reviewSchema } from '@/lib/server/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Invalid review status', 422);
  await setProjectReviewStatus(id, parsed.data.status);
  return ok(await getProject(id));
}
