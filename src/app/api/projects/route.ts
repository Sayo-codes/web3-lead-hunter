import type { NextRequest } from 'next/server';
import { listProjects, getSettings } from '@/lib/db/repository';
import { boolParam, fail, numParam, ok } from '@/lib/server/api';
import { requireUser } from '@/lib/server/auth';
import type { ProjectFilters } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const auth = await requireUser(); if (!auth.ok) return auth.response;
  try {
    const sp = req.nextUrl.searchParams;
    const settings = await getSettings();
    const filters: ProjectFilters = {
      search: sp.get('search') || undefined,
      chain: (sp.get('chain') as ProjectFilters['chain']) || undefined,
      age: sp.get('age') || undefined,
      minLiquidity: numParam(sp.get('minLiquidity')),
      maxLiquidity: numParam(sp.get('maxLiquidity')),
      minVolume: numParam(sp.get('minVolume')),
      maxVolume: numParam(sp.get('maxVolume')),
      minTransactions: numParam(sp.get('minTransactions')),
      minScore: numParam(sp.get('minScore')),
      community: (sp.get('community') as ProjectFilters['community']) ?? settings.community_requirement,
      requireAccessible: boolParam(sp.get('requireAccessible')) ?? settings.require_accessible_community,
      includeUnverifiedInvites: boolParam(sp.get('includeUnverifiedInvites')) ?? settings.include_unverified_telegram_invites,
      hasWebsite: boolParam(sp.get('hasWebsite')),
      hasTelegram: boolParam(sp.get('hasTelegram')),
      hasDiscord: boolParam(sp.get('hasDiscord')),
      reviewStatus: (sp.get('reviewStatus') as ProjectFilters['reviewStatus']) || undefined,
      qualifiedOnly: boolParam(sp.get('qualifiedOnly')),
      discoveredAfter: sp.get('discoveredAfter') || undefined,
      discoveredBefore: sp.get('discoveredBefore') || undefined,
      sort: (sp.get('sort') as ProjectFilters['sort']) || 'newest',
      page: numParam(sp.get('page')) ?? 1,
      pageSize: numParam(sp.get('pageSize')) ?? 25,
    };
    return ok(await listProjects(filters));
  } catch (e) { return fail(e instanceof Error ? e.message : 'Failed to list projects', 500); }
}
