import { one, q } from '@/lib/db';
import type {
  ApiSource, CommunityLink, DashboardStats, DiscoveryJob, MessageTemplate, Notification, OutreachHistory,
  OverallWorkerStatus, Project, ProjectFilters, Prospect, SocialLink, TradingPair, UserSettings, WorkerHealth, WorkerHeartbeat,
} from '@/lib/types';
import { toNumber } from '@/lib/utils';

function n(v: unknown): number | null { return v === null || v === undefined ? null : Number(v); }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.map(String) : []; }
function json<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return v as T;
}

export function mapSettings(r: any): UserSettings {
  return {
    id: r.id,
    discovery_interval_minutes: Number(r.discovery_interval_minutes),
    enabled_chains: arr(r.enabled_chains) as UserSettings['enabled_chains'],
    min_liquidity_usd: Number(r.min_liquidity_usd ?? 0),
    max_liquidity_usd: n(r.max_liquidity_usd),
    min_volume_24h_usd: Number(r.min_volume_24h_usd ?? 0),
    max_volume_24h_usd: n(r.max_volume_24h_usd),
    min_transactions_24h: Number(r.min_transactions_24h ?? 0),
    max_token_age_hours: Number(r.max_token_age_hours),
    include_unknown_age: Boolean(r.include_unknown_age),
    min_qualification_score: Number(r.min_qualification_score),
    community_requirement: r.community_requirement,
    require_accessible_community: Boolean(r.require_accessible_community),
    include_unverified_telegram_invites: Boolean(r.include_unverified_telegram_invites),
    auto_refresh_dashboard: Boolean(r.auto_refresh_dashboard),
    dashboard_refresh_seconds: Number(r.dashboard_refresh_seconds),
    notifications_enabled: Boolean(r.notifications_enabled),
    notify_qualified: Boolean(r.notify_qualified),
    notify_both_communities: Boolean(r.notify_both_communities),
    gecko_max_pages: Number(r.gecko_max_pages),
    gecko_per_chain: Boolean(r.gecko_per_chain),
    dex_enrichment_batch_size: Number(r.dex_enrichment_batch_size),
    community_check_ttl_hours: Number(r.community_check_ttl_hours),
    duplicate_contact_window_hours: Number(r.duplicate_contact_window_hours ?? 168),
    owner_name: r.owner_name ?? '',
    owner_services: arr(r.owner_services),
    contact_email: r.contact_email ?? '',
    updated_at: r.updated_at,
  };
}

export function mapProject(r: any): Project {
  return {
    id: r.id,
    token_id: r.token_id,
    chain: r.chain,
    contract_address: r.contract_address,
    contract_address_key: r.contract_address_key,
    name: r.name,
    symbol: r.symbol,
    description: r.description ?? null,
    website: r.website ?? null,
    twitter_url: r.twitter_url ?? null,
    telegram_url: r.telegram_url ?? null,
    discord_url: r.discord_url ?? null,
    github_url: r.github_url ?? null,
    discovered_at: r.discovered_at,
    token_created_at: r.token_created_at ?? null,
    liquidity_usd: n(r.liquidity_usd),
    volume_24h_usd: n(r.volume_24h_usd),
    transaction_count_24h: n(r.transaction_count_24h),
    buys_24h: n(r.buys_24h),
    sells_24h: n(r.sells_24h),
    market_cap_usd: n(r.market_cap_usd),
    fdv_usd: n(r.fdv_usd),
    price_usd: n(r.price_usd),
    pair_count: Number(r.pair_count ?? 0),
    primary_pair_address: r.primary_pair_address ?? null,
    primary_dex: r.primary_dex ?? null,
    qualification_score: Number(r.qualification_score ?? 0),
    qualification_reasons: json(r.qualification_reasons, []),
    is_qualified: Boolean(r.is_qualified),
    review_status: r.review_status,
    has_telegram_group: Boolean(r.has_telegram_group),
    has_discord_server: Boolean(r.has_discord_server),
    has_accessible_community: Boolean(r.has_accessible_community),
    market_data_source: r.market_data_source ?? null,
    metadata_source: r.metadata_source ?? null,
    data_flags: json(r.data_flags, {}),
    last_market_update_at: r.last_market_update_at ?? null,
    last_enriched_at: r.last_enriched_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    image_url: r.image_url ?? null,
  };
}

function mapPair(r: any): TradingPair {
  return { ...r, price_usd: n(r.price_usd), liquidity_usd: n(r.liquidity_usd), volume_24h_usd: n(r.volume_24h_usd), transaction_count_24h: n(r.transaction_count_24h), buys_24h: n(r.buys_24h), sells_24h: n(r.sells_24h), fdv_usd: n(r.fdv_usd), market_cap_usd: n(r.market_cap_usd) };
}
function mapCommunity(r: any): CommunityLink {
  return { ...r, is_verified: Boolean(r.is_verified), member_count: n(r.member_count), raw_evidence: json(r.raw_evidence, {}) };
}
function mapProspect(r: any): Prospect {
  const project = r.project_name ? ({
    id: r.project_id, token_id: '', chain: r.project_chain, contract_address: r.project_contract_address, contract_address_key: '',
    name: r.project_name, symbol: r.project_symbol, description: null, website: r.project_website ?? null, twitter_url: r.project_twitter_url ?? null,
    telegram_url: r.project_telegram_url ?? null, discord_url: r.project_discord_url ?? null, github_url: null,
    discovered_at: r.project_discovered_at, token_created_at: r.project_token_created_at ?? null,
    liquidity_usd: n(r.project_liquidity_usd), volume_24h_usd: n(r.project_volume_24h_usd), transaction_count_24h: null, buys_24h: null, sells_24h: null,
    market_cap_usd: null, fdv_usd: null, price_usd: null, pair_count: 0, primary_pair_address: null, primary_dex: null,
    qualification_score: Number(r.project_score ?? 0), qualification_reasons: [], is_qualified: Boolean(r.project_is_qualified),
    review_status: r.project_review_status, has_telegram_group: Boolean(r.project_has_telegram_group), has_discord_server: Boolean(r.project_has_discord_server),
    has_accessible_community: Boolean(r.project_has_accessible_community), market_data_source: null, metadata_source: null, data_flags: {},
    last_market_update_at: null, last_enriched_at: null, created_at: r.project_discovered_at, updated_at: r.updated_at, image_url: r.project_image_url ?? null,
  } as Project) : undefined;
  return { ...r, project };
}

export async function getSettings(): Promise<UserSettings> {
  const row = await one(`SELECT * FROM user_settings WHERE id = 'default'`);
  if (!row) throw new Error('Settings not initialized. Run migrations/seed.');
  return mapSettings(row);
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const s = { ...current, ...patch, id: 'default' };
  await q(
    `UPDATE user_settings SET
      discovery_interval_minutes=$1, enabled_chains=$2, min_liquidity_usd=$3, max_liquidity_usd=$4,
      min_volume_24h_usd=$5, max_volume_24h_usd=$6, min_transactions_24h=$7, max_token_age_hours=$8,
      include_unknown_age=$9, min_qualification_score=$10, community_requirement=$11, require_accessible_community=$12,
      include_unverified_telegram_invites=$13, auto_refresh_dashboard=$14, dashboard_refresh_seconds=$15,
      notifications_enabled=$16, notify_qualified=$17, notify_both_communities=$18, gecko_max_pages=$19,
      gecko_per_chain=$20, dex_enrichment_batch_size=$21, community_check_ttl_hours=$22, duplicate_contact_window_hours=$23,
      owner_name=$24, owner_services=$25, contact_email=$26, updated_at=now()
     WHERE id='default'`,
    [s.discovery_interval_minutes, s.enabled_chains, s.min_liquidity_usd, s.max_liquidity_usd, s.min_volume_24h_usd, s.max_volume_24h_usd, s.min_transactions_24h, s.max_token_age_hours, s.include_unknown_age, s.min_qualification_score, s.community_requirement, s.require_accessible_community, s.include_unverified_telegram_invites, s.auto_refresh_dashboard, s.dashboard_refresh_seconds, s.notifications_enabled, s.notify_qualified, s.notify_both_communities, s.gecko_max_pages, s.gecko_per_chain, s.dex_enrichment_batch_size, s.community_check_ttl_hours, s.duplicate_contact_window_hours, s.owner_name, s.owner_services, s.contact_email],
  );
  return getSettings();
}

export async function getApiSources(): Promise<ApiSource[]> {
  const rows = await q(`SELECT * FROM api_sources ORDER BY id`);
  return rows.map((r: any) => ({ ...r, enabled: Boolean(r.enabled), rate_limit_per_min: Number(r.rate_limit_per_min), config: json(r.config, {}) }));
}

export async function updateSourceHealth(id: string, patch: { health_status?: ApiSource['health_status']; last_error?: string | null; last_status_code?: number | null; success?: boolean }) {
  await q(
    `UPDATE api_sources SET
      health_status = COALESCE($2, health_status),
      last_error = $3,
      last_status_code = $4,
      last_success_at = CASE WHEN $5 THEN now() ELSE last_success_at END,
      last_error_at = CASE WHEN $5 THEN last_error_at ELSE now() END,
      updated_at = now()
     WHERE id = $1`,
    [id, patch.health_status ?? null, patch.last_error ?? null, patch.last_status_code ?? null, Boolean(patch.success)],
  );
}

export async function setSourceEnabled(id: string, enabled: boolean) {
  await q('UPDATE api_sources SET enabled=$2, updated_at=now() WHERE id=$1', [id, enabled]);
}

const AGE_CONDITIONS: Record<string, string> = {
  '<1h': `p.token_created_at >= now() - interval '1 hour'`,
  '1-6h': `p.token_created_at < now() - interval '1 hour' AND p.token_created_at >= now() - interval '6 hours'`,
  '6-24h': `p.token_created_at < now() - interval '6 hours' AND p.token_created_at >= now() - interval '24 hours'`,
  '1-3d': `p.token_created_at < now() - interval '24 hours' AND p.token_created_at >= now() - interval '3 days'`,
  '3-7d': `p.token_created_at < now() - interval '3 days' AND p.token_created_at >= now() - interval '7 days'`,
  '7-30d': `p.token_created_at < now() - interval '7 days' AND p.token_created_at >= now() - interval '30 days'`,
  '>30d': `p.token_created_at < now() - interval '30 days'`,
  unknown: `p.token_created_at IS NULL`,
};

export async function listProjects(filters: ProjectFilters): Promise<{ rows: Project[]; total: number; page: number; pageSize: number }> {
  const where: string[] = [];
  const p: unknown[] = [];
  const param = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (filters.search) {
    const s = param(`%${filters.search}%`);
    where.push(`(p.name ILIKE ${s} OR p.symbol ILIKE ${s} OR p.contract_address ILIKE ${s})`);
  }
  if (filters.chain && filters.chain !== 'all') where.push(`p.chain = ${param(filters.chain)}`);
  if (filters.age && AGE_CONDITIONS[filters.age]) where.push(AGE_CONDITIONS[filters.age]);
  if (filters.minLiquidity !== undefined) where.push(`p.liquidity_usd >= ${param(filters.minLiquidity)}`);
  if (filters.maxLiquidity !== undefined) where.push(`p.liquidity_usd <= ${param(filters.maxLiquidity)}`);
  if (filters.minVolume !== undefined) where.push(`p.volume_24h_usd >= ${param(filters.minVolume)}`);
  if (filters.maxVolume !== undefined) where.push(`p.volume_24h_usd <= ${param(filters.maxVolume)}`);
  if (filters.minTransactions !== undefined) where.push(`p.transaction_count_24h >= ${param(filters.minTransactions)}`);
  if (filters.minScore !== undefined) where.push(`p.qualification_score >= ${param(filters.minScore)}`);
  if (filters.hasWebsite) where.push(`p.website IS NOT NULL`);
  if (filters.hasTelegram) where.push(`p.telegram_url IS NOT NULL`);
  if (filters.hasDiscord) where.push(`p.discord_url IS NOT NULL`);
  if (filters.reviewStatus && filters.reviewStatus !== 'all') where.push(`p.review_status = ${param(filters.reviewStatus)}`);
  if (filters.qualifiedOnly) where.push(`p.is_qualified = true`);
  if (filters.discoveredAfter) where.push(`p.discovered_at >= ${param(filters.discoveredAfter)}`);
  if (filters.discoveredBefore) where.push(`p.discovered_at <= ${param(filters.discoveredBefore)}`);
  const requireAccessible = filters.requireAccessible ?? true;
  const includeInvites = filters.includeUnverifiedInvites ?? false;
  const telegramCond = () => {
    const ra = param(requireAccessible);
    const inv = param(includeInvites);
    return `(EXISTS (SELECT 1 FROM community_links cl WHERE cl.project_id = p.id AND cl.platform = 'telegram' AND cl.community_type = 'group' AND (${ra} = false OR cl.validation_status IN ('verified','accessible'))) OR (${inv} AND EXISTS (SELECT 1 FROM community_links cl WHERE cl.project_id = p.id AND cl.platform = 'telegram' AND cl.community_type = 'private_invite')))`;
  };
  const discordCond = () => {
    const ra = param(requireAccessible);
    return `EXISTS (SELECT 1 FROM community_links cl WHERE cl.project_id = p.id AND cl.platform = 'discord' AND cl.community_type = 'server' AND (${ra} = false OR cl.validation_status IN ('verified','accessible')))`;
  };
  switch (filters.community) {
    case 'telegram_group': where.push(telegramCond()); break;
    case 'discord_server': where.push(discordCond()); break;
    case 'both': where.push(`(${telegramCond()}) AND (${discordCond()})`); break;
    case 'either': where.push(`(${telegramCond()}) OR (${discordCond()})`); break;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortMap: Record<string, string> = {
    newest: 'p.discovered_at DESC',
    oldest: 'p.discovered_at ASC',
    liquidity: 'p.liquidity_usd DESC NULLS LAST',
    volume: 'p.volume_24h_usd DESC NULLS LAST',
    score: 'p.qualification_score DESC, p.discovered_at DESC',
  };
  const order = sortMap[filters.sort ?? 'newest'] ?? sortMap.newest;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const countRows = await q<{ count: string }>(`SELECT COUNT(*)::text AS count FROM projects p ${whereSql}`, p);
  const rows = await q(
    `SELECT p.*, t.image_url FROM projects p LEFT JOIN tokens t ON t.id = p.token_id ${whereSql} ORDER BY ${order} LIMIT ${param(pageSize)} OFFSET ${param(offset)}`,
    p,
  );
  return { rows: rows.map(mapProject), total: Number(countRows[0]?.count ?? 0), page, pageSize };
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await one(`SELECT p.*, t.image_url FROM projects p LEFT JOIN tokens t ON t.id = p.token_id WHERE p.id = $1`, [id]);
  if (!row) return null;
  const project = mapProject(row);
  const [pairs, social, community, prospect, outreach] = await Promise.all([
    q(`SELECT * FROM trading_pairs WHERE project_id = $1 ORDER BY liquidity_usd DESC NULLS LAST, last_updated_at DESC`, [id]),
    q(`SELECT * FROM social_links WHERE project_id = $1 ORDER BY platform, discovered_at`, [id]),
    q(`SELECT * FROM community_links WHERE project_id = $1 ORDER BY platform, validation_status DESC`, [id]),
    one(`SELECT * FROM prospects WHERE project_id = $1`, [id]),
    q(`SELECT * FROM outreach_history WHERE project_id = $1 ORDER BY contacted_at DESC LIMIT 100`, [id]),
  ]);
  project.trading_pairs = pairs.map(mapPair);
  project.social_links = social as unknown as SocialLink[];
  project.community_links = community.map(mapCommunity);
  project.prospect = prospect ? (prospect as unknown as Prospect) : null;
  project.outreach_history = outreach as unknown as OutreachHistory[];
  return project;
}

export async function getStats(): Promise<DashboardStats> {
  const r = await one<any>(`SELECT
    COUNT(*)::int AS total_projects,
    COUNT(*) FILTER (WHERE discovered_at >= date_trunc('day', now()))::int AS new_today,
    COUNT(*) FILTER (WHERE has_telegram_group)::int AS telegram_groups,
    COUNT(*) FILTER (WHERE has_discord_server)::int AS discord_servers,
    COUNT(*) FILTER (WHERE has_telegram_group AND has_discord_server)::int AS both_communities,
    COUNT(*) FILTER (WHERE is_qualified)::int AS qualified_prospects,
    COUNT(*) FILTER (WHERE review_status = 'new')::int AS awaiting_review,
    COUNT(*) FILTER (WHERE review_status = 'contacted')::int AS contacted
    FROM projects`);
  const pr = await one<any>(`SELECT COUNT(*)::int AS saved_prospects, COUNT(*) FILTER (WHERE status = 'client')::int AS clients FROM prospects`);
  return {
    total_projects: r?.total_projects ?? 0,
    new_today: r?.new_today ?? 0,
    telegram_groups: r?.telegram_groups ?? 0,
    discord_servers: r?.discord_servers ?? 0,
    both_communities: r?.both_communities ?? 0,
    qualified_prospects: r?.qualified_prospects ?? 0,
    awaiting_review: r?.awaiting_review ?? 0,
    contacted: r?.contacted ?? 0,
    saved_prospects: pr?.saved_prospects ?? 0,
    clients: pr?.clients ?? 0,
  };
}

export async function listNotifications(limit = 50, unreadOnly = false): Promise<Notification[]> {
  const rows = await q(`SELECT * FROM notifications ${unreadOnly ? 'WHERE read_at IS NULL' : ''} ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows as unknown as Notification[];
}
export async function createNotification(input: { project_id?: string | null; type: string; title: string; body?: string | null }) {
  await q(`INSERT INTO notifications (project_id, type, title, body) VALUES ($1,$2,$3,$4)`, [input.project_id ?? null, input.type, input.title, input.body ?? null]);
}
export async function markNotificationsRead(ids?: string[]) {
  if (ids && ids.length) await q(`UPDATE notifications SET read_at = now() WHERE id = ANY($1::uuid[])`, [ids]);
  else await q(`UPDATE notifications SET read_at = now() WHERE read_at IS NULL`);
}

export async function listProspects(filters: { status?: string; opportunity?: string; search?: string } = {}): Promise<Prospect[]> {
  const where: string[] = [];
  const p: unknown[] = [];
  const param = (v: unknown) => { p.push(v); return `$${p.length}`; };
  if (filters.status && filters.status !== 'all') where.push(`pr.status = ${param(filters.status)}`);
  if (filters.opportunity && filters.opportunity !== 'all') where.push(`pr.opportunity_status = ${param(filters.opportunity)}`);
  if (filters.search) { const s = param(`%${filters.search}%`); where.push(`(p.name ILIKE ${s} OR p.symbol ILIKE ${s} OR p.contract_address ILIKE ${s})`); }
  const rows = await q(
    `SELECT pr.*, p.name AS project_name, p.symbol AS project_symbol, p.chain AS project_chain, p.contract_address AS project_contract_address,
      p.qualification_score AS project_score, p.is_qualified AS project_is_qualified, p.discovered_at AS project_discovered_at,
      p.token_created_at AS project_token_created_at, p.liquidity_usd AS project_liquidity_usd, p.volume_24h_usd AS project_volume_24h_usd,
      p.review_status AS project_review_status, p.has_telegram_group AS project_has_telegram_group, p.has_discord_server AS project_has_discord_server,
      p.has_accessible_community AS project_has_accessible_community, p.website AS project_website, p.telegram_url AS project_telegram_url,
      p.discord_url AS project_discord_url, p.twitter_url AS project_twitter_url, t.image_url AS project_image_url
     FROM prospects pr JOIN projects p ON p.id = pr.project_id LEFT JOIN tokens t ON t.id = p.token_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY pr.updated_at DESC LIMIT 500`, p);
  return rows.map(mapProspect);
}

export async function saveProspect(projectId: string): Promise<Prospect> {
  const row = await one(`INSERT INTO prospects (project_id) VALUES ($1) ON CONFLICT (project_id) DO UPDATE SET updated_at = now() RETURNING *`, [projectId]);
  return row as unknown as Prospect;
}

const PROSPECT_TO_REVIEW: Record<string, string> = {
  new_lead: 'new', reviewed: 'reviewed', ready_to_contact: 'ready_to_contact', contacted: 'contacted', replied: 'replied', interested: 'interested', negotiating: 'negotiating', client: 'client', not_interested: 'not_interested',
};

export async function updateProspect(id: string, patch: Partial<Prospect>): Promise<Prospect | null> {
  const current = await one<any>('SELECT * FROM prospects WHERE id = $1', [id]);
  if (!current) return null;
  const s = { ...current, ...patch };
  await q(
    `UPDATE prospects SET status=$2, notes=$3, contact_platform=$4, contacted_at=$5, responded_at=$6, response_notes=$7,
      opportunity_status=$8, next_follow_up_at=$9, updated_at=now() WHERE id=$1`,
    [id, s.status, s.notes ?? '', s.contact_platform ?? null, s.contacted_at ?? null, s.responded_at ?? null, s.response_notes ?? '', s.opportunity_status, s.next_follow_up_at ?? null],
  );
  if (patch.status) await q('UPDATE projects SET review_status=$2, updated_at=now() WHERE id=$1', [current.project_id, PROSPECT_TO_REVIEW[patch.status] ?? 'new']);
  return one<Prospect>('SELECT * FROM prospects WHERE id = $1', [id]);
}

export async function setProjectReviewStatus(projectId: string, status: string) {
  await q('UPDATE projects SET review_status=$2, updated_at=now() WHERE id=$1', [projectId, status]);
  const prospect = await one<any>('SELECT * FROM prospects WHERE project_id=$1', [projectId]);
  if (prospect) {
    const reverse: Record<string, string> = { new: 'new_lead', reviewed: 'reviewed', ready_to_contact: 'ready_to_contact', contacted: 'contacted', replied: 'replied', interested: 'interested', negotiating: 'negotiating', client: 'client', not_interested: 'not_interested' };
    await q('UPDATE prospects SET status=$2, updated_at=now() WHERE id=$1', [prospect.id, reverse[status] ?? 'new_lead']);
  }
}

export async function recordOutreach(projectId: string, input: { platform?: string | null; message: string; status?: string; contacted_at?: string | null; response_notes?: string | null; force?: boolean }, duplicateWindowHours: number): Promise<{ duplicate: boolean; last?: OutreachHistory; history?: OutreachHistory }> {
  const last = await one<OutreachHistory>(`SELECT * FROM outreach_history WHERE project_id=$1 AND contacted_at >= now() - ($2 * interval '1 hour') ORDER BY contacted_at DESC LIMIT 1`, [projectId, duplicateWindowHours]);
  if (last && !input.force) return { duplicate: true, last };
  const prospect = await saveProspect(projectId);
  const contactedAt = input.contacted_at ?? new Date().toISOString();
  const history = await one<OutreachHistory>(
    `INSERT INTO outreach_history (project_id, prospect_id, platform, message, status, contacted_at, response_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [projectId, prospect.id, input.platform ?? null, input.message, input.status ?? 'contacted', contactedAt, input.response_notes ?? null],
  );
  await q(`UPDATE prospects SET status='contacted', contact_platform=$2, contacted_at=$3, updated_at=now() WHERE id=$1`, [prospect.id, input.platform ?? null, contactedAt]);
  await q(`UPDATE projects SET review_status='contacted', updated_at=now() WHERE id=$1`, [projectId]);
  return { duplicate: false, history: history ?? undefined };
}

export async function deleteProspect(id: string): Promise<boolean> {
  const prospect = await one<any>('SELECT * FROM prospects WHERE id=$1', [id]);
  if (!prospect) return false;
  await q('DELETE FROM outreach_history WHERE prospect_id=$1', [id]);
  await q('DELETE FROM prospects WHERE id=$1', [id]);
  await q(`UPDATE projects SET review_status='new', updated_at=now() WHERE id=$1`, [prospect.project_id]);
  return true;
}

export async function listTemplates(): Promise<MessageTemplate[]> {
  const rows = await q('SELECT * FROM message_templates ORDER BY is_default DESC, name');
  return rows.map((r: any) => ({ ...r, services: arr(r.services), is_default: Boolean(r.is_default) }));
}
export async function createTemplate(input: { name: string; subject?: string | null; body: string; services?: string[]; is_default?: boolean }): Promise<MessageTemplate> {
  const row = await one<any>(`INSERT INTO message_templates (name, subject, body, services, is_default) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [input.name, input.subject ?? null, input.body, input.services ?? [], input.is_default ?? false]);
  return { ...row, services: arr(row.services), is_default: Boolean(row.is_default) };
}
export async function updateTemplate(id: string, input: Partial<MessageTemplate>): Promise<MessageTemplate | null> {
  const current = await one<any>('SELECT * FROM message_templates WHERE id=$1', [id]);
  if (!current) return null;
  const s = { ...current, ...input };
  await q('UPDATE message_templates SET name=$2, subject=$3, body=$4, services=$5, is_default=$6, updated_at=now() WHERE id=$1', [id, s.name, s.subject ?? null, s.body, s.services ?? [], s.is_default ?? false]);
  const row = await one<any>('SELECT * FROM message_templates WHERE id=$1', [id]);
  return { ...row, services: arr(row.services), is_default: Boolean(row.is_default) };
}
export async function deleteTemplate(id: string) { await q('DELETE FROM message_templates WHERE id=$1', [id]); }

export function mapJob(r: any): DiscoveryJob {
  return {
    id: r.id,
    status: r.status,
    trigger_source: r.trigger_source,
    created_at: r.created_at,
    started_at: r.started_at ?? null,
    finished_at: r.finished_at ?? null,
    duration_ms: n(r.duration_ms),
    projects_created: Number(r.projects_created ?? 0),
    projects_updated: Number(r.projects_updated ?? 0),
    pairs_upserted: Number(r.pairs_upserted ?? 0),
    links_found: Number(r.links_found ?? 0),
    links_validated: Number(r.links_validated ?? 0),
    provider_stats: json(r.provider_stats, {}),
    error: r.error ?? null,
    logs: json(r.logs, []),
    locked_by: r.locked_by ?? null,
    heartbeat_at: r.heartbeat_at ?? null,
    retry_count: Number(r.retry_count ?? 0),
    max_retries: Number(r.max_retries ?? 3),
  };
}

export async function createJob(trigger: DiscoveryJob['trigger_source']): Promise<DiscoveryJob> {
  const row = await one<any>(`INSERT INTO discovery_jobs (status, trigger_source) VALUES ('queued', $1) RETURNING *`, [trigger]);
  return mapJob(row);
}

export async function getJob(id: string): Promise<DiscoveryJob | null> {
  const row = await one<any>('SELECT * FROM discovery_jobs WHERE id=$1', [id]);
  return row ? mapJob(row) : null;
}

export async function listJobs(limit = 50): Promise<DiscoveryJob[]> {
  const rows = await q('SELECT * FROM discovery_jobs ORDER BY created_at DESC LIMIT $1', [limit]);
  return rows.map(mapJob);
}

export async function nextQueuedJob(): Promise<DiscoveryJob | null> {
  const row = await one<any>(`SELECT * FROM discovery_jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 1`);
  return row ? mapJob(row) : null;
}

export async function claimQueuedJob(owner: string): Promise<DiscoveryJob | null> {
  const row = await one<any>(
    `UPDATE discovery_jobs
     SET status = 'running', started_at = now(), locked_by = $1, heartbeat_at = now()
     WHERE id = (
       SELECT id FROM discovery_jobs
       WHERE status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1
     )
     RETURNING *`,
    [owner],
  );
  return row ? mapJob(row) : null;
}

export async function markJobRunning(id: string, owner?: string) {
  await q(
    `UPDATE discovery_jobs
     SET status = 'running',
         started_at = COALESCE(started_at, now()),
         locked_by = COALESCE($2, locked_by),
         heartbeat_at = now()
     WHERE id = $1`,
    [id, owner ?? null],
  );
}

export async function updateJobHeartbeat(jobId: string, owner: string): Promise<boolean> {
  const rows = await q(
    `UPDATE discovery_jobs
     SET heartbeat_at = now()
     WHERE id = $1 AND (locked_by = $2 OR locked_by IS NULL) AND status = 'running'
     RETURNING id`,
    [jobId, owner],
  );
  return rows.length > 0;
}

export async function finishJob(id: string, patch: Partial<DiscoveryJob> & { status: DiscoveryJob['status'] }) {
  const current = await getJob(id);
  if (!current) return;
  const s = { ...current, ...patch };
  await q(
    `UPDATE discovery_jobs SET
       status = $2,
       finished_at = now(),
       duration_ms = $3,
       projects_created = $4,
       projects_updated = $5,
       pairs_upserted = $6,
       links_found = $7,
       links_validated = $8,
       provider_stats = $9,
       error = $10,
       logs = $11,
       heartbeat_at = now(),
       locked_by = NULL
     WHERE id = $1`,
    [
      id,
      s.status,
      s.duration_ms ?? null,
      s.projects_created,
      s.projects_updated,
      s.pairs_upserted,
      s.links_found,
      s.links_validated,
      JSON.stringify(s.provider_stats ?? {}),
      s.error ?? null,
      JSON.stringify(s.logs ?? []),
    ],
  );
}

export async function recoverStaleJobs(heartbeatTimeoutSeconds = 120): Promise<{ recoveredCount: number; failedCount: number }> {
  const staleRunning = await q<any>(
    `SELECT * FROM discovery_jobs
     WHERE status = 'running'
       AND (
         (heartbeat_at IS NOT NULL AND heartbeat_at < now() - ($1 * interval '1 second'))
         OR (heartbeat_at IS NULL AND started_at < now() - ($1 * interval '1 second'))
       )`,
    [heartbeatTimeoutSeconds],
  );

  let recoveredCount = 0;
  let failedCount = 0;

  for (const job of staleRunning) {
    const currentRetries = Number(job.retry_count ?? 0);
    const maxRetries = Number(job.max_retries ?? 3);
    const logs = json<Array<{ at: string; level: string; message: string }>>(job.logs, []);

    if (currentRetries < maxRetries) {
      logs.push({
        at: new Date().toISOString(),
        level: 'warn',
        message: `Recovered stale job: worker heartbeat timeout (${heartbeatTimeoutSeconds}s). Re-queuing (retry ${currentRetries + 1}/${maxRetries}).`,
      });
      await q(
        `UPDATE discovery_jobs
         SET status = 'queued',
             retry_count = retry_count + 1,
             locked_by = NULL,
             heartbeat_at = NULL,
             logs = $2
         WHERE id = $1`,
        [job.id, JSON.stringify(logs)],
      );
      recoveredCount++;
    } else {
      logs.push({
        at: new Date().toISOString(),
        level: 'error',
        message: `Job failed: exceeded maximum retries (${maxRetries}) after worker crash or heartbeat timeout.`,
      });
      await q(
        `UPDATE discovery_jobs
         SET status = 'failed',
             finished_at = now(),
             locked_by = NULL,
             error = 'Exceeded maximum retries after worker heartbeat timeout',
             logs = $2
         WHERE id = $1`,
        [job.id, JSON.stringify(logs)],
      );
      failedCount++;
    }
  }

  // Also clear expired worker locks
  await q(`UPDATE worker_locks SET locked_until = now(), updated_at = now() WHERE locked_until < now()`);

  return { recoveredCount, failedCount };
}

export async function lastJobCreatedAt(): Promise<string | null> {
  const r = await one<{ created_at: string }>(`SELECT created_at FROM discovery_jobs ORDER BY created_at DESC LIMIT 1`);
  return r?.created_at ?? null;
}

export async function acquireLock(id: string, seconds: number, owner: string): Promise<boolean> {
  const rows = await q(
    `INSERT INTO worker_locks (id, locked_until, locked_by, updated_at)
     VALUES ($1, now() + ($2 * interval '1 second'), $3, now())
     ON CONFLICT (id) DO UPDATE SET
       locked_until = EXCLUDED.locked_until,
       locked_by = EXCLUDED.locked_by,
       updated_at = now()
     WHERE worker_locks.locked_until < now() OR worker_locks.locked_by = EXCLUDED.locked_by
     RETURNING id`,
    [id, seconds, owner],
  );
  return rows.length > 0;
}

export async function renewLock(id: string, seconds: number, owner: string): Promise<boolean> {
  const rows = await q(
    `UPDATE worker_locks
     SET locked_until = now() + ($2 * interval '1 second'), updated_at = now()
     WHERE id = $1 AND locked_by = $3
     RETURNING id`,
    [id, seconds, owner],
  );
  return rows.length > 0;
}

export async function releaseLock(id: string, owner?: string): Promise<boolean> {
  const rows = await q(
    `UPDATE worker_locks
     SET locked_until = now(), updated_at = now()
     WHERE id = $1 AND ($2::text IS NULL OR locked_by = $2 OR locked_until < now())
     RETURNING id`,
    [id, owner ?? null],
  );
  return rows.length > 0;
}

export async function recordWorkerHeartbeat(workerId: string, data: {
  worker_mode?: 'in_process' | 'standalone';
  status?: 'idle' | 'processing' | 'stopping' | 'stopped';
  current_job_id?: string | null;
  consecutive_failures?: number;
  last_error?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await q(
    `INSERT INTO worker_heartbeats (worker_id, worker_mode, status, current_job_id, last_heartbeat_at, consecutive_failures, last_error, metadata, updated_at)
     VALUES ($1, COALESCE($2, 'standalone'), COALESCE($3, 'idle'), $4, now(), COALESCE($5, 0), $6, $7, now())
     ON CONFLICT (worker_id) DO UPDATE SET
       worker_mode = COALESCE(EXCLUDED.worker_mode, worker_heartbeats.worker_mode),
       status = COALESCE(EXCLUDED.status, worker_heartbeats.status),
       current_job_id = EXCLUDED.current_job_id,
       last_heartbeat_at = now(),
       consecutive_failures = COALESCE(EXCLUDED.consecutive_failures, worker_heartbeats.consecutive_failures),
       last_error = EXCLUDED.last_error,
       metadata = COALESCE(EXCLUDED.metadata, worker_heartbeats.metadata),
       updated_at = now()`,
    [
      workerId,
      data.worker_mode ?? null,
      data.status ?? null,
      data.current_job_id ?? null,
      data.consecutive_failures ?? null,
      data.last_error ?? null,
      JSON.stringify(data.metadata ?? {}),
    ],
  );
}

export async function clearWorkerHeartbeat(workerId: string): Promise<void> {
  await q(`UPDATE worker_heartbeats SET status = 'stopped', last_heartbeat_at = now(), current_job_id = NULL, updated_at = now() WHERE worker_id = $1`, [workerId]);
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  // Prune workers that have not reported heartbeat in > 3 minutes to 'stopped'
  await q(`UPDATE worker_heartbeats SET status = 'stopped', updated_at = now() WHERE status != 'stopped' AND last_heartbeat_at < now() - interval '3 minutes'`);

  // Active workers (heartbeat within 60s)
  const activeRows = await q<any>(
    `SELECT * FROM worker_heartbeats
     WHERE status IN ('idle', 'processing') AND last_heartbeat_at >= now() - interval '60 seconds'
     ORDER BY last_heartbeat_at DESC`,
  );

  const runningJobRow = await one<any>(
    `SELECT * FROM discovery_jobs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1`,
  );
  const runningJob = runningJobRow ? mapJob(runningJobRow) : null;

  const queuedCountRow = await one<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM discovery_jobs WHERE status = 'queued'`,
  );
  const queuedCount = Number(queuedCountRow?.count ?? 0);

  const lastSuccess = await one<{ finished_at: string; duration_ms: number }>(
    `SELECT finished_at, duration_ms FROM discovery_jobs WHERE status = 'completed' ORDER BY finished_at DESC LIMIT 1`,
  );

  const lastFailed = await one<{ finished_at: string; error: string }>(
    `SELECT finished_at, error FROM discovery_jobs WHERE status = 'failed' ORDER BY finished_at DESC LIMIT 1`,
  );

  const failed24hRow = await one<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM discovery_jobs WHERE status = 'failed' AND created_at >= now() - interval '24 hours'`,
  );

  const recentJobs = await q<{ status: string; error: string | null }>(
    `SELECT status, error FROM discovery_jobs WHERE status IN ('completed', 'failed', 'completed_with_errors') ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 10`,
  );
  let consecutiveFailures = 0;
  for (const j of recentJobs) {
    if (j.status === 'failed') consecutiveFailures++;
    else break;
  }

  const latestHeartbeat = activeRows[0]?.last_heartbeat_at ?? null;
  const isProcessing = runningJob !== null || activeRows.some((w: any) => w.status === 'processing');

  let status: OverallWorkerStatus = 'idle';
  if (consecutiveFailures >= 3) {
    status = 'error';
  } else if (isProcessing) {
    status = 'processing';
  } else if (activeRows.length > 0) {
    status = 'idle';
  } else {
    status = 'unavailable';
  }

  return {
    status,
    active_workers: activeRows.length,
    workers: activeRows.map((r: any) => ({
      worker_id: r.worker_id,
      worker_mode: r.worker_mode,
      status: r.status,
      last_heartbeat_at: r.last_heartbeat_at,
      current_job_id: r.current_job_id,
    })),
    last_heartbeat: latestHeartbeat,
    last_successful_discovery: lastSuccess?.finished_at ?? null,
    last_failed_discovery: lastFailed?.finished_at ?? null,
    currently_running_job: runningJob,
    queued_jobs_count: queuedCount,
    failed_jobs_count_24h: Number(failed24hRow?.count ?? 0),
    consecutive_failures: consecutiveFailures,
    last_error: lastFailed?.error ?? null,
    last_discovery_duration_ms: lastSuccess?.duration_ms ? Number(lastSuccess.duration_ms) : null,
  };
}
