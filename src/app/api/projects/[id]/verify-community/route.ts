import { getServerConfig } from '@/lib/config';
import { q } from '@/lib/db';
import { getProject, getSettings } from '@/lib/db/repository';
import { validateCommunityLink } from '@/lib/community/validate';
import { fail, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import { recomputeProjectQualification } from '@/lib/server/ingestion';
import type { CommunityLink } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const project = await getProject(id);
  if (!project) return fail('Project not found', 404);
  const settings = await getSettings();
  const cfg = getServerConfig();
  const links = (project.community_links ?? []) as CommunityLink[];
  const target = body?.communityLinkId ? links.filter((l) => l.id === body.communityLinkId) : links;
  let checked = 0;
  for (const link of target) {
    const result = await validateCommunityLink(link, settings.community_check_ttl_hours, { publicPageChecks: cfg.telegramPublicPageChecks, discordChecks: cfg.discordInviteChecks });
    await q(`UPDATE community_links SET community_type=$2, validation_status=$3, verification_method=$4, is_verified=$5, member_count=$6, title=$7, error=$8, raw_evidence=$9, last_checked_at=now(), next_check_at=now() + ($10 * interval '1 hour'), updated_at=now() WHERE id=$1`,
      [link.id, result.community_type, result.validation_status, result.verification_method, result.is_verified, result.member_count, result.title, result.error, JSON.stringify(result.raw_evidence ?? {}), settings.community_check_ttl_hours]);
    checked++;
  }
  await recomputeProjectQualification(id);
  return ok({ checked, project: await getProject(id) });
}
