import type { ChainId, DiscoveredToken, ProviderResult, UserSettings } from '@/lib/types';

export interface TokenRef {
  chain: ChainId;
  address: string;
}

export interface ProviderContext {
  settings: UserSettings;
  geckoApiKey?: string | null;
  geckoUsePaid?: boolean;
  geckoRateLimitPerMin?: number;
  dexRateLimitPerMin?: number;
}

export interface DiscoveryProvider {
  id: string;
  name: string;
  discover(ctx: ProviderContext): Promise<ProviderResult>;
  enrich?(tokens: TokenRef[], ctx: ProviderContext): Promise<ProviderResult>;
  metadataUpdates?(ctx: ProviderContext): Promise<ProviderResult>;
}

export function emptyResult(provider: string): ProviderResult {
  return { provider, tokens: [], errors: [], stats: {} };
}

export function tokenKey(chain: ChainId, address: string): string {
  return `${chain}:${address}`;
}

export function mergeToken(target: DiscoveredToken, incoming: DiscoveredToken): DiscoveredToken {
  const links = [...target.links];
  const seen = new Set(links.map((l) => `${l.platform}:${l.url.toLowerCase()}`));
  for (const l of incoming.links) {
    const k = `${l.platform}:${l.url.toLowerCase()}`;
    if (!seen.has(k)) {
      seen.add(k);
      links.push(l);
    }
  }
  const pairs = [...target.pairs];
  const pairSeen = new Set(pairs.map((p) => `${p.chain}:${p.pairAddress.toLowerCase()}`));
  for (const p of incoming.pairs) {
    const k = `${p.chain}:${p.pairAddress.toLowerCase()}`;
    if (!pairSeen.has(k)) {
      pairSeen.add(k);
      pairs.push(p);
    }
  }
  const created = [target.tokenCreatedAt, incoming.tokenCreatedAt].filter(Boolean).sort()[0] ?? null;
  return {
    ...target,
    name: target.name || incoming.name,
    symbol: target.symbol || incoming.symbol,
    decimals: target.decimals ?? incoming.decimals,
    imageUrl: target.imageUrl || incoming.imageUrl,
    description: target.description || incoming.description,
    coingeckoCoinId: target.coingeckoCoinId || incoming.coingeckoCoinId,
    gtScore: target.gtScore ?? incoming.gtScore,
    metadataUpdatedAt: incoming.metadataUpdatedAt || target.metadataUpdatedAt,
    tokenCreatedAt: created,
    pairs,
    links,
    marketDataSource: target.marketDataSource || incoming.marketDataSource,
    metadataSource: target.metadataSource || incoming.metadataSource,
  };
}
