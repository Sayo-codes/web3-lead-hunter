import { getProject, getSettings, listTemplates } from '@/lib/db/repository';
import { generateMessage } from '@/lib/outreach/templates';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body?.projectId) return fail('projectId required');
  const project = await getProject(body.projectId);
  if (!project) return fail('Project not found', 404);
  const templates = await listTemplates();
  const template = templates.find((t) => t.id === body.templateId) ?? templates.find((t) => t.is_default) ?? templates[0];
  if (!template) return fail('No message template available', 400);
  const settings = await getSettings();
  const message = generateMessage(template, project, settings, Array.isArray(body.services) ? body.services : undefined);
  return ok({ message, subject: template.subject ?? '', templateId: template.id });
}
