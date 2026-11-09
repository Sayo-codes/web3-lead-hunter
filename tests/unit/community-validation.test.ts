import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJson = vi.fn();
const fetchText = vi.fn();
class MockHttpError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
vi.mock('@/lib/server/http', () => ({
  fetchJson: (...args: unknown[]) => fetchJson(...args),
  fetchText: (...args: unknown[]) => fetchText(...args),
  HttpError: MockHttpError,
}));
vi.mock('@/lib/server/secrets', () => ({ getProviderSecret: vi.fn(async () => null) }));

describe('community verification', () => {
  beforeEach(() => { fetchJson.mockReset(); fetchText.mockReset(); });

  it('verifies Discord server invitations through the official invite API shape', async () => {
    fetchJson.mockResolvedValue({ code: 'abc', type: 0, guild: { id: '123', name: 'Test Server' }, approximate_member_count: 42 });
    const { validateDiscordInvite } = await import('@/lib/community/validate');
    const res = await validateDiscordInvite('https://discord.gg/abc', 6, true);
    expect(res.community_type).toBe('server');
    expect(res.validation_status).toBe('verified');
    expect(res.is_verified).toBe(true);
    expect(res.member_count).toBe(42);
    expect(res.title).toBe('Test Server');
  });

  it('marks expired/unknown Discord invites invalid without bypassing restrictions', async () => {
    fetchJson.mockRejectedValue(new MockHttpError('HTTP 404', 404));
    const { validateDiscordInvite } = await import('@/lib/community/validate');
    const res = await validateDiscordInvite('https://discord.gg/missing', 6, true);
    expect(res.validation_status).toBe('invalid');
    expect(res.is_verified).toBe(false);
  });

  it('uses Telegram public-page members as an accessible group hint, not bot verification', async () => {
    fetchText.mockResolvedValue('<div class="tgme_page_title"><span>Test Group</span></div><div class="tgme_page_extra">1 234 members</div>');
    const { validateTelegramLink } = await import('@/lib/community/validate');
    const res = await validateTelegramLink('https://t.me/testgroup', 6, { publicPageChecks: true });
    expect(res.community_type).toBe('group');
    expect(res.validation_status).toBe('accessible');
    expect(res.is_verified).toBe(false);
    expect(res.member_count).toBe(1234);
    expect(res.verification_method).toBe('telegram_public_page');
  });

  it('distinguishes Telegram channels from groups on public pages', async () => {
    fetchText.mockResolvedValue('<div class="tgme_page_title"><span>Test Channel</span></div><div class="tgme_page_extra">10 subscribers</div>');
    const { validateTelegramLink } = await import('@/lib/community/validate');
    const res = await validateTelegramLink('https://t.me/testchannel', 6, { publicPageChecks: true });
    expect(res.community_type).toBe('channel');
    expect(res.validation_status).toBe('accessible');
    expect(res.is_verified).toBe(false);
  });

  it('does not auto-join or claim private Telegram invites are groups', async () => {
    const { validateTelegramLink } = await import('@/lib/community/validate');
    const res = await validateTelegramLink('https://t.me/+secretcode', 6, { publicPageChecks: true });
    expect(res.community_type).toBe('private_invite');
    expect(res.validation_status).toBe('unknown');
    expect(res.is_verified).toBe(false);
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('marks Telegram groups verified only when Bot API confirms the chat type', async () => {
    fetchJson.mockResolvedValue({ ok: true, result: { id: -1001, type: 'supergroup', title: 'Verified Group' } });
    const { validateTelegramLink } = await import('@/lib/community/validate');
    const res = await validateTelegramLink('https://t.me/verifiedgroup', 6, { botToken: 'bot-token', publicPageChecks: true });
    expect(res.community_type).toBe('group');
    expect(res.validation_status).toBe('verified');
    expect(res.is_verified).toBe(true);
    expect(res.verification_method).toBe('telegram_bot_api');
  });
});
