import { beforeEach, describe, expect, it, vi } from 'vitest';
import geckoPools from '../../docs/research/gecko-new-pools-sample.json';
import { CHAIN_IDS } from '@/lib/chains';
import type { UserSettings } from '@/lib/types';

const fetchJson = vi.fn();
vi.mock('@/lib/server/http', () => ({
  fetchJson: (...args: unknown[]) => fetchJson(...args),
  HttpError: class HttpError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } },
}));

const baseSettings = {
  enabled_chains: CHAIN_IDS,
  gecko_max_pages: 10,
  gecko_per_chain: false,
  discovery_interval_minutes: 1,
} as UserSettings;

describe('GeckoTerminal rate-limit scheduling', () => {
  beforeEach(() => fetchJson.mockReset());

  it('caps discovery requests per run and reserves metadata budget on short intervals', async () => {
    fetchJson.mockResolvedValue(geckoPools);
    const { GeckoTerminalProvider } = await import('@/lib/providers/geckoterminal');
    const provider = new GeckoTerminalProvider();
    const res = await provider.discover({ settings: baseSettings, geckoRateLimitPerMin: 5 });
    expect(res.errors).toHaveLength(0);
    // floor(5 * 1 * 0.7) = 3 total budget, minus 1 reserved for metadata = 2 discovery calls.
    expect(fetchJson.mock.calls.length).toBeLessThanOrEqual(2);
    expect(res.stats.requestsPlanned).toBeLessThanOrEqual(2);
  });

  it('rotates per-chain requests instead of always starving later chains', async () => {
    fetchJson.mockResolvedValue(geckoPools);
    const { GeckoTerminalProvider } = await import('@/lib/providers/geckoterminal');
    const provider = new GeckoTerminalProvider();
    const res = await provider.discover({ settings: { ...baseSettings, gecko_per_chain: true }, geckoRateLimitPerMin: 5 });
    expect(fetchJson.mock.calls.length).toBeLessThanOrEqual(2);
    const urls = fetchJson.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes('/networks/'))).toBe(true);
  });
});
