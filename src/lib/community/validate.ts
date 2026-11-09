import type { CommunityLink, CommunityType, ValidationStatus } from '@/lib/types';
import { fetchJson, fetchText, HttpError } from '@/lib/server/http';
import { getProviderSecret } from '@/lib/server/secrets';
import { normalizeTelegramUrl } from './extract';

export interface CommunityValidationResult {
  community_type: CommunityType;
  validation_status: ValidationStatus;
  verification_method: string;
  is_verified: boolean;
  member_count: number | null;
  title: string | null;
  error: string | null;
  raw_evidence: Record<string, unknown>;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseTelegramPublicPage(html: string): { kind: 'group' | 'channel' | 'unknown'; title: string | null; memberCount: number | null; extra: string | null } {
  const extraMatch = html.match(/<div class="tgme_page_extra">([\s\S]*?)<\/div>/i);
  const titleMatch = html.match(/<div class="tgme_page_title"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
  const extra = extraMatch ? decodeEntities(extraMatch[1].replace(/<[^>]+>/g, '').trim()) : null;
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : null;
  let kind: 'group' | 'channel' | 'unknown' = 'unknown';
  let memberCount: number | null = null;
  if (extra) {
    const num = extra.replace(/[^\d]/g, '');
    if (num) memberCount = Number(num);
    if (/members?/i.test(extra) || /online/i.test(extra)) kind = 'group';
    else if (/subscribers?/i.test(extra)) kind = 'channel';
  }
  if (kind === 'unknown' && /Preview channel/i.test(html)) kind = 'channel';
  if (kind === 'unknown' && /tgme_page_context_link[^>]*>Preview group/i.test(html)) kind = 'group';
  return { kind, title, memberCount, extra };
}

export async function validateDiscordInvite(url: string, ttlHours: number, enabled = true): Promise<CommunityValidationResult> {
  const base: CommunityValidationResult = {
    community_type: 'server',
    validation_status: 'unknown',
    verification_method: 'url_pattern',
    is_verified: false,
    member_count: null,
    title: null,
    error: null,
    raw_evidence: {},
  };
  if (!enabled) return { ...base, validation_status: 'unverified', error: 'Discord invite checks disabled' };
  const code = url.split('/').pop();
  if (!code) return { ...base, validation_status: 'invalid', error: 'Missing invite code' };
  try {
    const data = await fetchJson<Record<string, unknown>>(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`, {
      provider: 'discord',
      rateLimitPerMin: 20,
      cacheTtlMs: ttlHours * 3600000,
      retries: 1,
      timeoutMs: 12000,
    });
    const guild = data.guild as Record<string, unknown> | undefined;
    if (guild && guild.id) {
      return {
        community_type: 'server',
        validation_status: 'verified',
        verification_method: 'discord_invite_api',
        is_verified: true,
        member_count: typeof data.approximate_member_count === 'number' ? data.approximate_member_count : null,
        title: typeof guild.name === 'string' ? guild.name : null,
        error: null,
        raw_evidence: { guild_id: guild.id, code: data.code, expires_at: data.expires_at ?? null, type: data.type },
      };
    }
    return { ...base, validation_status: 'unknown', error: 'Invite response did not include a guild', raw_evidence: { code: data.code } };
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 404 || err.status === 400) return { ...base, validation_status: 'invalid', error: `Invite not found or expired (HTTP ${err.status})` };
      if (err.status === 401 || err.status === 403) return { ...base, validation_status: 'restricted', error: `Invite restricted (HTTP ${err.status})` };
      return { ...base, validation_status: 'error', error: `HTTP ${err.status}` };
    }
    return { ...base, validation_status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function validateTelegramLink(url: string, ttlHours: number, opts: { botToken?: string | null; publicPageChecks?: boolean }): Promise<CommunityValidationResult> {
  const parsed = normalizeTelegramUrl(url);
  const base: CommunityValidationResult = {
    community_type: parsed?.communityType ?? 'unknown',
    validation_status: 'unknown',
    verification_method: 'url_pattern',
    is_verified: false,
    member_count: null,
    title: null,
    error: null,
    raw_evidence: {},
  };
  if (!parsed) return { ...base, validation_status: 'invalid', error: 'Unrecognized Telegram URL' };

  if (parsed.communityType === 'private_invite') {
    return { ...base, validation_status: 'unknown', verification_method: 'url_pattern', error: 'Private invite; group/channel type cannot be verified without joining, which is not performed.' };
  }

  const username = parsed.publicUsername;
  const botToken = opts.botToken ?? (await getProviderSecret('telegram_bot'));
  if (botToken && username) {
    try {
      const data = await fetchJson<{ ok: boolean; result?: Record<string, unknown>; description?: string }>(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent('@' + username)}`,
        { provider: 'telegram', rateLimitPerMin: 10, cacheTtlMs: ttlHours * 3600000, retries: 0, timeoutMs: 12000 },
      );
      if (data.ok && data.result) {
        const type = String(data.result.type || '');
        const communityType: CommunityType = type === 'channel' ? 'channel' : type === 'group' || type === 'supergroup' ? 'group' : 'unknown';
        if (communityType !== 'unknown') {
          return {
            community_type: communityType,
            validation_status: 'verified',
            verification_method: 'telegram_bot_api',
            is_verified: true,
            member_count: null,
            title: typeof data.result.title === 'string' ? data.result.title : null,
            error: null,
            raw_evidence: { chat_id: data.result.id, type },
          };
        }
      }
    } catch (err) {
      // Bot may not be a member; fall back to public page hint. Do not treat bot access errors as invalid links.
      base.raw_evidence = { bot_error: err instanceof Error ? err.message : 'bot check failed' };
    }
  }

  if (opts.publicPageChecks !== false && username) {
    try {
      const html = await fetchText(`https://t.me/${encodeURIComponent(username)}`, {
        provider: 'telegram',
        rateLimitPerMin: 10,
        cacheTtlMs: ttlHours * 3600000,
        retries: 1,
        timeoutMs: 12000,
      });
      const parsedPage = parseTelegramPublicPage(html);
      if (parsedPage.kind !== 'unknown') {
        return {
          community_type: parsedPage.kind,
          validation_status: 'accessible',
          verification_method: 'telegram_public_page',
          is_verified: false,
          member_count: parsedPage.memberCount,
          title: parsedPage.title,
          error: null,
          raw_evidence: { public_page_extra: parsedPage.extra, hint: true },
        };
      }
      return { ...base, validation_status: 'unverified', verification_method: 'telegram_public_page', error: 'Public page did not expose a group/channel hint', raw_evidence: { ...base.raw_evidence, title: parsedPage.title } };
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return { ...base, validation_status: 'invalid', error: 'Telegram page not found' };
      return { ...base, validation_status: 'unverified', error: err instanceof Error ? err.message : 'Public page check failed' };
    }
  }

  return { ...base, validation_status: 'unverified', error: 'No permitted verification method available' };
}

export async function validateCommunityLink(link: Pick<CommunityLink, 'platform' | 'normalized_url'>, ttlHours: number, opts: { publicPageChecks?: boolean; discordChecks?: boolean } = {}): Promise<CommunityValidationResult> {
  if (link.platform === 'discord') return validateDiscordInvite(link.normalized_url, ttlHours, opts.discordChecks !== false);
  return validateTelegramLink(link.normalized_url, ttlHours, { publicPageChecks: opts.publicPageChecks });
}
