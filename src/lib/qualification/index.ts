import type { CommunityLink, Project, QualificationReason, UserSettings } from '@/lib/types';
import { ageBucket } from '@/lib/utils';

export interface CommunityFlags {
  has_telegram_group: boolean;
  has_discord_server: boolean;
  has_accessible_community: boolean;
  telegram_verified: boolean;
  discord_verified: boolean;
  telegram_private_invite: boolean;
}

export function computeCommunityFlags(links: CommunityLink[], settings?: Pick<UserSettings, 'require_accessible_community' | 'include_unverified_telegram_invites'>): CommunityFlags {
  const requireAccessible = settings?.require_accessible_community ?? true;
  const includeInvites = settings?.include_unverified_telegram_invites ?? false;
  const telegram = links.filter((l) => l.platform === 'telegram');
  const discord = links.filter((l) => l.platform === 'discord');
  const tgAccessible = telegram.some((l) => l.community_type === 'group' && (!requireAccessible || l.validation_status === 'verified' || l.validation_status === 'accessible'));
  const tgInvite = includeInvites && telegram.some((l) => l.community_type === 'private_invite');
  const dcAccessible = discord.some((l) => l.community_type === 'server' && (!requireAccessible || l.validation_status === 'verified' || l.validation_status === 'accessible'));
  return {
    has_telegram_group: tgAccessible || tgInvite,
    has_discord_server: dcAccessible,
    has_accessible_community: tgAccessible || tgInvite || dcAccessible,
    telegram_verified: telegram.some((l) => l.is_verified && l.community_type === 'group'),
    discord_verified: discord.some((l) => l.is_verified && l.community_type === 'server'),
    telegram_private_invite: telegram.some((l) => l.community_type === 'private_invite'),
  };
}

export function communityRequirementPasses(flags: CommunityFlags, requirement: UserSettings['community_requirement']): boolean {
  switch (requirement) {
    case 'telegram_group': return flags.has_telegram_group;
    case 'discord_server': return flags.has_discord_server;
    case 'both': return flags.has_telegram_group && flags.has_discord_server;
    case 'either': return flags.has_telegram_group || flags.has_discord_server;
    case 'any': return true;
  }
}

export interface QualificationInput {
  token_created_at: string | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  transaction_count_24h: number | null;
  website: string | null;
  twitter_url: string | null;
  github_url: string | null;
  description: string | null;
  image_url?: string | null;
  communityLinks: CommunityLink[];
}

export function scoreProject(input: QualificationInput, now = Date.now()): { score: number; reasons: QualificationReason[] } {
  const reasons: QualificationReason[] = [];
  const add = (code: string, label: string, points: number, detail: string) => reasons.push({ code, label, points, detail });

  // Age recency: 0-20
  const bucket = ageBucket(input.token_created_at, now);
  const agePoints: Record<string, number> = { '<1h': 20, '1-6h': 18, '6-24h': 15, '1-3d': 12, '3-7d': 8, '7-30d': 4, '>30d': 0, unknown: 2 };
  const ap = agePoints[bucket] ?? 0;
  add('age', 'Project recency', ap, input.token_created_at ? `Earliest known pair creation is in the ${bucket} bucket. Pair creation is not guaranteed token creation.` : 'Creation time unavailable from providers; small unknown-age credit only.');

  // Liquidity: 0-15
  const liq = input.liquidity_usd;
  let lp = 0;
  if (liq !== null) {
    if (liq >= 100000) lp = 15;
    else if (liq >= 50000) lp = 12;
    else if (liq >= 10000) lp = 9;
    else if (liq >= 5000) lp = 6;
    else if (liq >= 1000) lp = 3;
    else if (liq > 0) lp = 1;
  }
  add('liquidity', 'Liquidity depth', lp, liq === null ? 'Liquidity unavailable from providers.' : `$${liq.toLocaleString()} liquidity suggests an operational market, not proof of service need.`);

  // Activity: 0-15 (transactions 10, volume 5)
  const tx = input.transaction_count_24h;
  let txp = 0;
  if (tx !== null) {
    if (tx >= 500) txp = 10;
    else if (tx >= 100) txp = 7;
    else if (tx >= 25) txp = 4;
    else if (tx > 0) txp = 1;
  }
  const vol = input.volume_24h_usd;
  let vp = 0;
  if (vol !== null) {
    if (vol >= 100000) vp = 5;
    else if (vol >= 10000) vp = 3;
    else if (vol >= 1000) vp = 1;
  }
  add('activity', 'Trading activity', txp + vp, `${tx === null ? 'Unknown' : tx.toLocaleString()} 24h transactions; ${vol === null ? 'unknown' : '$' + vol.toLocaleString()} 24h volume. Activity is a contactability signal, not proof the team needs development work.`);

  // Community: 0-30
  const flags = computeCommunityFlags(input.communityLinks, { require_accessible_community: true, include_unverified_telegram_invites: false });
  const tg = input.communityLinks.filter((l) => l.platform === 'telegram' && l.community_type === 'group');
  const dc = input.communityLinks.filter((l) => l.platform === 'discord' && l.community_type === 'server');
  const tgBest = tg.some((l) => l.validation_status === 'verified') ? 15 : tg.some((l) => l.validation_status === 'accessible') ? 10 : 0;
  const dcBest = dc.some((l) => l.validation_status === 'verified' || l.validation_status === 'accessible') ? 15 : 0;
  if (tgBest > 0) add('telegram', 'Telegram group', tgBest, tg.some((l) => l.is_verified) ? 'Group verified via Telegram Bot API.' : 'Group indicated by accessible public Telegram page hint; not bot-verified.');
  else if (flags.telegram_private_invite) add('telegram_invite', 'Telegram private invite', 0, 'Private invite found, but group/channel type is unknown and is not auto-joined.');
  else add('telegram', 'Telegram group', 0, 'No accessible Telegram group detected.');
  if (dcBest > 0) add('discord', 'Discord server', dcBest, 'Discord invite validated through the official invite API.');
  else add('discord', 'Discord server', 0, 'No validated Discord server invitation detected.');

  // Information completeness: 0-20
  let info = 0;
  if (input.website) { info += 6; add('website', 'Website', 6, 'Official website link available from provider metadata.'); }
  else add('website', 'Website', 0, 'No website link available.');
  if (input.twitter_url) { info += 4; add('twitter', 'X/Twitter', 4, 'X/Twitter profile available from provider metadata.'); }
  else add('twitter', 'X/Twitter', 0, 'No X/Twitter profile available.');
  if (input.github_url) { info += 4; add('github', 'GitHub', 4, 'GitHub repository/organization available; useful for development-service fit.'); }
  else add('github', 'GitHub', 0, 'No GitHub link available.');
  if (input.description && input.description.trim().length > 40) { info += 4; add('description', 'Project description', 4, 'Provider metadata includes a substantive description.'); }
  else add('description', 'Project description', 0, 'No substantive project description available.');
  if (input.image_url) { info += 2; add('image', 'Project image', 2, 'Project image available from provider metadata.'); }
  else add('image', 'Project image', 0, 'No project image available.');

  const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0)));
  return { score, reasons };
}

export interface SettingsCheckResult {
  passes: boolean;
  failures: string[];
}

export function passesSettings(project: Pick<Project, 'token_created_at' | 'liquidity_usd' | 'volume_24h_usd' | 'transaction_count_24h' | 'qualification_score'>, flags: CommunityFlags, settings: UserSettings, now = Date.now()): SettingsCheckResult {
  const failures: string[] = [];
  if (project.token_created_at) {
    const ageHours = (now - new Date(project.token_created_at).getTime()) / 3600000;
    if (ageHours > settings.max_token_age_hours) failures.push(`Older than ${settings.max_token_age_hours}h`);
  } else if (!settings.include_unknown_age) {
    failures.push('Unknown age excluded');
  }
  if (settings.min_liquidity_usd > 0 && (project.liquidity_usd === null || project.liquidity_usd < settings.min_liquidity_usd)) failures.push('Below minimum liquidity');
  if (settings.max_liquidity_usd !== null && project.liquidity_usd !== null && project.liquidity_usd > settings.max_liquidity_usd) failures.push('Above maximum liquidity');
  if (settings.min_volume_24h_usd > 0 && (project.volume_24h_usd === null || project.volume_24h_usd < settings.min_volume_24h_usd)) failures.push('Below minimum 24h volume');
  if (settings.max_volume_24h_usd !== null && project.volume_24h_usd !== null && project.volume_24h_usd > settings.max_volume_24h_usd) failures.push('Above maximum 24h volume');
  if (settings.min_transactions_24h > 0 && (project.transaction_count_24h === null || project.transaction_count_24h < settings.min_transactions_24h)) failures.push('Below minimum transactions');
  if (project.qualification_score < settings.min_qualification_score) failures.push('Below minimum qualification score');
  if (!communityRequirementPasses(flags, settings.community_requirement)) failures.push('Community requirement not met');
  return { passes: failures.length === 0, failures };
}
