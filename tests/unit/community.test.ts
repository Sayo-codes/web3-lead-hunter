import { describe, expect, it } from 'vitest';
import { communityCandidatesFromLinks, extractUrlsFromText, linksFromText, normalizeDiscordUrl, normalizeTelegramUrl, telegramHandleToUrl } from '@/lib/community/extract';

describe('community URL extraction and classification', () => {
  it('normalizes public Telegram URLs', () => {
    expect(normalizeTelegramUrl('https://t.me/groupname')).toMatchObject({ normalizedUrl: 'https://t.me/groupname', communityType: 'unknown', publicUsername: 'groupname' });
    expect(normalizeTelegramUrl('https://telegram.me/groupname')).toMatchObject({ normalizedUrl: 'https://t.me/groupname' });
    expect(normalizeTelegramUrl('t.me/s/channelname')).toMatchObject({ normalizedUrl: 'https://t.me/channelname', communityType: 'channel' });
  });

  it('recognizes private Telegram invite formats without claiming group type', () => {
    expect(normalizeTelegramUrl('https://t.me/+AbCdEf123')).toMatchObject({ communityType: 'private_invite', inviteCode: 'AbCdEf123' });
    expect(normalizeTelegramUrl('https://telegram.me/joinchat/AbCdEf123')).toMatchObject({ communityType: 'private_invite', normalizedUrl: 'https://t.me/joinchat/AbCdEf123' });
    expect(normalizeTelegramUrl('https://t.me/joinchat/AbCdEf123')).toMatchObject({ communityType: 'private_invite' });
  });

  it('normalizes Discord invite formats', () => {
    expect(normalizeDiscordUrl('https://discord.gg/AbCd123')).toEqual({ normalizedUrl: 'https://discord.gg/AbCd123', inviteCode: 'AbCd123' });
    expect(normalizeDiscordUrl('https://discord.com/invite/AbCd123')).toEqual({ normalizedUrl: 'https://discord.gg/AbCd123', inviteCode: 'AbCd123' });
    expect(normalizeDiscordUrl('https://discordapp.com/invite/AbCd123')).toEqual({ normalizedUrl: 'https://discord.gg/AbCd123', inviteCode: 'AbCd123' });
  });

  it('extracts URLs from provider descriptions', () => {
    const urls = extractUrlsFromText('Join https://t.me/mygroup and https://discord.gg/abc123. Site: www.example.com');
    expect(urls).toContain('https://t.me/mygroup');
    expect(urls).toContain('https://discord.gg/abc123');
    expect(urls).toContain('https://www.example.com');
  });

  it('builds community candidates and keeps private invites unknown', () => {
    const links = linksFromText('https://t.me/+secret123 https://discord.gg/server1 https://t.me/publicgroup', 'test');
    const candidates = communityCandidatesFromLinks(links);
    const tgPrivate = candidates.find((c) => c.normalizedUrl === 'https://t.me/+secret123');
    const tgPublic = candidates.find((c) => c.normalizedUrl === 'https://t.me/publicgroup');
    const dc = candidates.find((c) => c.platform === 'discord');
    expect(tgPrivate?.communityType).toBe('private_invite');
    expect(tgPrivate?.validationStatus).toBe('unknown');
    expect(tgPublic?.communityType).toBe('unknown');
    expect(dc?.communityType).toBe('server');
    expect(dc?.validationStatus).toBe('unverified');
  });

  it('converts Telegram handles to URLs', () => {
    expect(telegramHandleToUrl('@my_group')).toBe('https://t.me/my_group');
    expect(telegramHandleToUrl('https://t.me/my_group')).toBe('https://t.me/my_group');
  });
});
