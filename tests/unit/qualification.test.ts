import { describe, expect, it } from 'vitest';
import { computeCommunityFlags, communityRequirementPasses, passesSettings, scoreProject } from '@/lib/qualification';
import type { CommunityLink, UserSettings } from '@/lib/types';

function link(partial: Partial<CommunityLink>): CommunityLink {
  return {
    id: 'x', project_id: 'p', social_link_id: null, platform: 'telegram', url: 'https://t.me/x', normalized_url: 'https://t.me/x',
    community_type: 'unknown', validation_status: 'unknown', verification_method: null, is_verified: false, member_count: null, title: null,
    invite_code: null, last_checked_at: null, next_check_at: null, error: null, raw_evidence: {}, ...partial,
  };
}

const settings = {
  id: 'default', discovery_interval_minutes: 3, enabled_chains: ['ethereum'], min_liquidity_usd: 0, max_liquidity_usd: null,
  min_volume_24h_usd: 0, max_volume_24h_usd: null, min_transactions_24h: 0, max_token_age_hours: 720, include_unknown_age: true,
  min_qualification_score: 40, community_requirement: 'either', require_accessible_community: true, include_unverified_telegram_invites: false,
  auto_refresh_dashboard: true, dashboard_refresh_seconds: 30, notifications_enabled: true, notify_qualified: true, notify_both_communities: true,
  gecko_max_pages: 1, gecko_per_chain: false, dex_enrichment_batch_size: 30, community_check_ttl_hours: 6, duplicate_contact_window_hours: 168,
  owner_name: '', owner_services: [], contact_email: '', updated_at: new Date().toISOString(),
} as UserSettings;

describe('qualification engine', () => {
  it('produces a transparent 0-100 score with reasons', () => {
    const now = Date.now();
    const result = scoreProject({
      token_created_at: new Date(now - 30 * 60000).toISOString(), liquidity_usd: 50000, volume_24h_usd: 20000, transaction_count_24h: 150,
      website: 'https://example.com', twitter_url: 'https://x.com/example', github_url: 'https://github.com/example', description: 'A sufficiently long project description for scoring.', image_url: 'https://example.com/i.png',
      communityLinks: [link({ platform: 'telegram', community_type: 'group', validation_status: 'accessible' }), link({ platform: 'discord', community_type: 'server', validation_status: 'verified', is_verified: true })],
    }, now);
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reasons.length).toBeGreaterThan(5);
    expect(result.reasons.reduce((s, r) => s + r.points, 0)).toBe(result.score);
    expect(result.reasons.some((r) => r.code === 'telegram' && r.points > 0)).toBe(true);
    expect(result.reasons.some((r) => r.code === 'discord' && r.points > 0)).toBe(true);
  });

  it('does not qualify high volume alone when community requirement is either', () => {
    const now = Date.now();
    const input = { token_created_at: new Date(now).toISOString(), liquidity_usd: 1000000, volume_24h_usd: 10000000, transaction_count_24h: 100000, website: 'https://example.com', twitter_url: null, github_url: null, description: null, communityLinks: [] as CommunityLink[] };
    const { score } = scoreProject(input, now);
    const flags = computeCommunityFlags([], settings);
    const check = passesSettings({ ...input, qualification_score: score } as any, flags, settings, now);
    expect(score).toBeGreaterThan(0);
    expect(check.passes).toBe(false);
    expect(check.failures).toContain('Community requirement not met');
  });

  it('supports both/either/telegram/discord community requirements', () => {
    const tg = computeCommunityFlags([link({ community_type: 'group', validation_status: 'accessible' })], settings);
    const dc = computeCommunityFlags([link({ platform: 'discord', community_type: 'server', validation_status: 'verified' })], settings);
    const both = computeCommunityFlags([link({ community_type: 'group', validation_status: 'accessible' }), link({ platform: 'discord', community_type: 'server', validation_status: 'verified' })], settings);
    expect(communityRequirementPasses(tg, 'telegram_group')).toBe(true);
    expect(communityRequirementPasses(tg, 'both')).toBe(false);
    expect(communityRequirementPasses(dc, 'discord_server')).toBe(true);
    expect(communityRequirementPasses(both, 'both')).toBe(true);
    expect(communityRequirementPasses(both, 'either')).toBe(true);
  });

  it('does not treat unverified private invites as accessible groups by default', () => {
    const flags = computeCommunityFlags([link({ community_type: 'private_invite', validation_status: 'unknown' })], settings);
    expect(flags.has_telegram_group).toBe(false);
    expect(flags.has_accessible_community).toBe(false);
  });
});
