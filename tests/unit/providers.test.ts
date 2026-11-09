import { beforeEach, describe, expect, it, vi } from 'vitest';
import dexTokens from '../../docs/research/dex-tokens-sample.json';
import geckoPools from '../../docs/research/gecko-new-pools-sample.json';
import geckoInfo from '../../docs/research/gecko-token-info-sample.json';
import type { UserSettings } from '@/lib/types';

const fetchJson = vi.fn();
vi.mock('@/lib/server/http', () => ({
  fetchJson: (...args: unknown[]) => fetchJson(...args),
  HttpError: class HttpError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } },
}));

const settings = {
  enabled_chains: ['ethereum', 'base', 'solana', 'bsc', 'arbitrum', 'optimism', 'polygon', 'avalanche'],
  gecko_max_pages: 1, gecko_per_chain: false, dex_enrichment_batch_size: 30,
} as UserSettings;

describe('provider normalization using saved live API fixtures', () => {
  beforeEach(() => fetchJson.mockReset());

  it('normalizes DEX Screener token pairs and social metadata', async () => {
    fetchJson.mockResolvedValue(dexTokens);
    const { DexScreenerProvider } = await import('@/lib/providers/dexscreener');
    const provider = new DexScreenerProvider();
    const address = (dexTokens as any[])[0].baseToken.address;
    const res = await provider.enrich([{ chain: 'ethereum', address }], { settings });
    expect(res.errors).toHaveLength(0);
    expect(res.tokens).toHaveLength(1);
    const token = res.tokens[0];
    expect(token.chain).toBe('ethereum');
    expect(token.symbol).toBe('BITS');
    expect(token.pairs.length).toBeGreaterThan(0);
    expect(token.pairs[0].liquidityUsd).toBeGreaterThan(0);
    expect(token.links.some((l) => l.platform === 'telegram')).toBe(true);
    expect(token.tokenCreatedAt).toBeTruthy();
  });

  it('normalizes GeckoTerminal new pools into token candidates', async () => {
    fetchJson.mockResolvedValue(geckoPools);
    const { GeckoTerminalProvider } = await import('@/lib/providers/geckoterminal');
    const provider = new GeckoTerminalProvider();
    const res = await provider.discover({ settings });
    expect(res.errors).toHaveLength(0);
    expect(res.tokens.length).toBeGreaterThan(0);
    const token = res.tokens[0];
    expect(token.chain).toBe('solana');
    expect(token.pairs).toHaveLength(1);
    expect(token.tokenCreatedAt).toBeTruthy();
    expect(token.marketDataSource).toBe('geckoterminal');
  });

  it('normalizes GeckoTerminal recently updated token metadata', async () => {
    fetchJson.mockResolvedValue(geckoInfo);
    const { GeckoTerminalProvider } = await import('@/lib/providers/geckoterminal');
    const provider = new GeckoTerminalProvider();
    const res = await provider.metadataUpdates!({ settings });
    expect(res.errors).toHaveLength(0);
    expect(res.tokens.length).toBeGreaterThan(0);
    expect(res.tokens.some((t) => t.links.some((l) => l.platform === 'telegram'))).toBe(true);
  });
});
