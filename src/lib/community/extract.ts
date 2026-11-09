import type { CommunityPlatform, CommunityType, RawLink, SocialPlatform } from '@/lib/types';
import { safeExternalUrl } from '@/lib/utils';

export interface CommunityCandidate {
  platform: CommunityPlatform;
  url: string;
  normalizedUrl: string;
  communityType: CommunityType;
  inviteCode: string | null;
  validationStatus: 'unknown' | 'unverified';
  verificationMethod: string;
  rawEvidence: Record<string, unknown>;
}

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.dog']);
const DISCORD_HOSTS = new Set(['discord.gg', 'discord.com', 'discordapp.com']);
const TWITTER_HOSTS = new Set(['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com']);
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

export function classifyPlatform(url: string): SocialPlatform {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (TELEGRAM_HOSTS.has(host)) return 'telegram';
    if (DISCORD_HOSTS.has(host)) return 'discord';
    if (TWITTER_HOSTS.has(host)) return 'twitter';
    if (GITHUB_HOSTS.has(host)) return 'github';
    const path = u.pathname.toLowerCase();
    if (path.includes('/docs') || host.startsWith('docs.')) return 'docs';
    return 'website';
  } catch {
    return 'other';
  }
}

export function normalizeTelegramUrl(input: string): { normalizedUrl: string; communityType: CommunityType; inviteCode: string | null; publicUsername: string | null } | null {
  const safe = safeExternalUrl(input.startsWith('http') ? input : `https://${input}`);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.toLowerCase();
  if (!TELEGRAM_HOSTS.has(host)) return null;
  let path = u.pathname.replace(/^\/+|\/+$/g, '');
  if (!path) return null;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 's' && parts[1]) {
    return { normalizedUrl: `https://t.me/${parts[1]}`, communityType: 'channel', inviteCode: null, publicUsername: parts[1] };
  }
  if (parts[0] === 'joinchat' && parts[1]) {
    return { normalizedUrl: `https://t.me/joinchat/${parts[1]}`, communityType: 'private_invite', inviteCode: parts[1], publicUsername: null };
  }
  if (parts[0].startsWith('+') && parts[0].length > 1) {
    const code = parts[0].slice(1);
    return { normalizedUrl: `https://t.me/+${code}`, communityType: 'private_invite', inviteCode: code, publicUsername: null };
  }
  const reserved = new Set(['m', 'addlist', 'addstickers', 'share', 'proxy', 'socksy', 'iv', 'joinchat', 's', 'c']);
  if (parts.length === 1 && !reserved.has(parts[0]) && /^[A-Za-z0-9_]{4,64}$/.test(parts[0])) {
    return { normalizedUrl: `https://t.me/${parts[0]}`, communityType: 'unknown', inviteCode: null, publicUsername: parts[0] };
  }
  return null;
}

export function normalizeDiscordUrl(input: string): { normalizedUrl: string; inviteCode: string } | null {
  const safe = safeExternalUrl(input.startsWith('http') ? input : `https://${input}`);
  if (!safe) return null;
  const u = new URL(safe);
  const host = u.hostname.toLowerCase();
  if (!DISCORD_HOSTS.has(host)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  let code: string | null = null;
  if (host === 'discord.gg') code = parts[0] ?? null;
  else if (parts[0] === 'invite') code = parts[1] ?? null;
  if (!code || !/^[A-Za-z0-9-]{2,64}$/.test(code)) return null;
  return { normalizedUrl: `https://discord.gg/${code}`, inviteCode: code };
}

export function telegramHandleToUrl(handle: string): string | null {
  const h = handle.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '').replace(/\/$/, '');
  if (!h) return null;
  return normalizeTelegramUrl(`https://t.me/${h}`)?.normalizedUrl ?? null;
}

export function twitterHandleToUrl(handle: string): string | null {
  const h = handle.trim().replace(/^@/, '').replace(/^https?:\/\/(x\.com|twitter\.com)\//, '').replace(/\/$/, '');
  if (!h || !/^[A-Za-z0-9_]{1,15}$/.test(h)) return null;
  return `https://x.com/${h}`;
}

export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(?:https?:\/\/|www\.)[^\s<>"'`)\]]+|(?:t\.me|telegram\.me|discord\.gg|discord\.com\/invite|github\.com|x\.com|twitter\.com)\/[^\s<>"'`)\]]+/gi);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[.,;:!?]+$/, '')).map((m) => (m.startsWith('http') ? m : `https://${m}`));
}

export function linksFromText(text: string | null | undefined, source: string): RawLink[] {
  if (!text) return [];
  const urls = extractUrlsFromText(text);
  const out: RawLink[] = [];
  for (const url of urls) {
    const safe = safeExternalUrl(url);
    if (!safe) continue;
    out.push({ platform: classifyPlatform(safe), url: safe, source, sourceKind: 'metadata_extracted' });
  }
  return dedupeRawLinks(out);
}

export function dedupeRawLinks(links: RawLink[]): RawLink[] {
  const seen = new Map<string, RawLink>();
  for (const link of links) {
    const safe = safeExternalUrl(link.url);
    if (!safe) continue;
    let url = safe;
    let platform = link.platform;
    if (platform === 'telegram') {
      const t = normalizeTelegramUrl(safe);
      if (!t) continue;
      url = t.normalizedUrl;
    } else if (platform === 'discord') {
      const d = normalizeDiscordUrl(safe);
      if (!d) continue;
      url = d.normalizedUrl;
    } else if (platform === 'twitter') {
      try {
        const u = new URL(safe);
        const handle = u.pathname.split('/').filter(Boolean)[0];
        if (handle) url = `https://x.com/${handle}`;
      } catch { /* keep */ }
    }
    const key = `${platform}:${url.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, { ...link, platform, url });
  }
  return [...seen.values()];
}

export function communityCandidatesFromLinks(links: RawLink[]): CommunityCandidate[] {
  const out: CommunityCandidate[] = [];
  const seen = new Set<string>();
  for (const link of dedupeRawLinks(links)) {
    if (link.platform === 'telegram') {
      const t = normalizeTelegramUrl(link.url);
      if (!t) continue;
      const key = `telegram:${t.normalizedUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        platform: 'telegram',
        url: link.url,
        normalizedUrl: t.normalizedUrl,
        communityType: t.communityType,
        inviteCode: t.inviteCode,
        validationStatus: t.communityType === 'private_invite' ? 'unknown' : 'unverified',
        verificationMethod: 'url_pattern',
        rawEvidence: { source: link.source, publicUsername: t.publicUsername },
      });
    } else if (link.platform === 'discord') {
      const d = normalizeDiscordUrl(link.url);
      if (!d) continue;
      const key = `discord:${d.normalizedUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        platform: 'discord',
        url: link.url,
        normalizedUrl: d.normalizedUrl,
        communityType: 'server',
        inviteCode: d.inviteCode,
        validationStatus: 'unverified',
        verificationMethod: 'url_pattern',
        rawEvidence: { source: link.source },
      });
    }
  }
  return out;
}

export function primarySocialUrls(links: RawLink[]) {
  const deduped = dedupeRawLinks(links);
  const pick = (platform: SocialPlatform) => deduped.find((l) => l.platform === platform)?.url ?? null;
  return {
    website: pick('website'),
    twitter_url: pick('twitter'),
    github_url: pick('github'),
    telegram_url: pick('telegram'),
    discord_url: pick('discord'),
  };
}
