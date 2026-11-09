import { addressKey, chainFromGeckoNetwork, getChain, isValidAddress } from '@/lib/chains';
import { dedupeRawLinks, linksFromText, telegramHandleToUrl, twitterHandleToUrl } from '@/lib/community/extract';
import { fetchJson, HttpError } from '@/lib/server/http';
import type { ChainId, DiscoveredToken, PairSnapshot, ProviderResult, RawLink } from '@/lib/types';
import { toNumber } from '@/lib/utils';
import { emptyResult, mergeToken, type DiscoveryProvider, type ProviderContext } from './types';

interface GeckoResource {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships?: Record<string, { data?: { id: string; type: string } | null }>;
}
interface GeckoResponse {
  data: GeckoResource[] | GeckoResource;
  included?: GeckoResource[];
}

function baseUrl(ctx: ProviderContext) {
  return ctx.geckoUsePaid && ctx.geckoApiKey ? 'https://api.coingecko.com/api/v3/onchain' : 'https://api.geckoterminal.com/api/v2';
}
function headers(ctx: ProviderContext): Record<string, string> {
  if (ctx.geckoUsePaid && ctx.geckoApiKey) return { 'x-cg-pro-api-key': ctx.geckoApiKey };
  return {};
}
function accept(ctx: ProviderContext) {
  return ctx.geckoUsePaid && ctx.geckoApiKey ? 'application/json' : 'application/json;version=20230203';
}

function includedMap(res: GeckoResponse): Map<string, GeckoResource> {
  const map = new Map<string, GeckoResource>();
  for (const item of res.included ?? []) map.set(item.id, item);
  return map;
}

function poolToToken(pool: GeckoResource, included: Map<string, GeckoResource>, enabled: Set<ChainId>): DiscoveredToken | null {
  const attrs = pool.attributes ?? {};
  const networkId = pool.relationships?.network?.data?.id || pool.id.split('_')[0];
  const chain = chainFromGeckoNetwork(networkId);
  if (!chain || !enabled.has(chain)) return null;
  const baseRel = pool.relationships?.base_token?.data?.id;
  const quoteRel = pool.relationships?.quote_token?.data?.id;
  const base = baseRel ? included.get(baseRel) : undefined;
  const quote = quoteRel ? included.get(quoteRel) : undefined;
  const address = base?.attributes?.address || (baseRel ? baseRel.split('_').slice(1).join('_') : null);
  if (!address || !isValidAddress(chain, address)) return null;
  const tx = attrs.transactions?.h24 ?? {};
  const buys = typeof tx.buys === 'number' ? tx.buys : null;
  const sells = typeof tx.sells === 'number' ? tx.sells : null;
  const pairAddress = attrs.address || pool.id.split('_').slice(1).join('_');
  const snapshot: PairSnapshot = {
    chain,
    pairAddress,
    dexId: pool.relationships?.dex?.data?.id ?? null,
    baseTokenAddress: address,
    quoteTokenAddress: quote?.attributes?.address ?? null,
    quoteSymbol: quote?.attributes?.symbol ?? null,
    priceUsd: toNumber(attrs.base_token_price_usd),
    liquidityUsd: toNumber(attrs.reserve_in_usd),
    volume24h: toNumber(attrs.volume_usd?.h24),
    transactionCount24h: buys !== null || sells !== null ? (buys ?? 0) + (sells ?? 0) : null,
    buys24h: buys,
    sells24h: sells,
    pairCreatedAt: attrs.pool_created_at ?? null,
    fdvUsd: toNumber(attrs.fdv_usd),
    marketCapUsd: toNumber(attrs.market_cap_usd),
    source: 'geckoterminal',
    sourceUrl: `https://www.geckoterminal.com/${networkId}/pools/${pairAddress}`,
    raw: attrs,
  };
  return {
    chain,
    address,
    name: base?.attributes?.name ?? (typeof attrs.name === 'string' ? attrs.name.split('/')[0]?.trim() : null),
    symbol: base?.attributes?.symbol ?? null,
    decimals: base?.attributes?.decimals ?? null,
    imageUrl: base?.attributes?.image_url ?? null,
    coingeckoCoinId: base?.attributes?.coingecko_coin_id ?? null,
    tokenCreatedAt: attrs.pool_created_at ?? null,
    pairs: [snapshot],
    links: [],
    source: 'geckoterminal',
    marketDataSource: 'geckoterminal',
    metadataSource: 'geckoterminal',
  };
}

function metadataToToken(resource: GeckoResource, enabled: Set<ChainId>): DiscoveredToken | null {
  const attrs = resource.attributes ?? {};
  const networkId = resource.relationships?.network?.data?.id || resource.id.split('_')[0];
  const chain = chainFromGeckoNetwork(networkId);
  if (!chain || !enabled.has(chain)) return null;
  const address = attrs.address || resource.id.split('_').slice(1).join('_');
  if (!address || !isValidAddress(chain, address)) return null;
  const links: RawLink[] = [];
  for (const w of attrs.websites ?? []) {
    if (typeof w === 'string' && w) links.push({ platform: 'website', url: w, source: 'geckoterminal', sourceKind: 'api' });
  }
  if (attrs.discord_url) links.push({ platform: 'discord', url: attrs.discord_url, source: 'geckoterminal', sourceKind: 'api' });
  if (attrs.telegram_handle) {
    const url = telegramHandleToUrl(attrs.telegram_handle);
    if (url) links.push({ platform: 'telegram', url, source: 'geckoterminal', sourceKind: 'api' });
  }
  if (attrs.twitter_handle) {
    const url = twitterHandleToUrl(attrs.twitter_handle);
    if (url) links.push({ platform: 'twitter', url, source: 'geckoterminal', sourceKind: 'api' });
  }
  links.push(...linksFromText(attrs.description, 'geckoterminal'));
  return {
    chain,
    address,
    name: attrs.name ?? null,
    symbol: attrs.symbol ?? null,
    decimals: attrs.decimals ?? null,
    imageUrl: attrs.image_url ?? null,
    description: attrs.description ?? null,
    coingeckoCoinId: attrs.coingecko_coin_id ?? null,
    gtScore: toNumber(attrs.gt_score),
    metadataUpdatedAt: attrs.metadata_updated_at ?? null,
    pairs: [],
    links: dedupeRawLinks(links),
    source: 'geckoterminal',
    metadataSource: 'geckoterminal',
  };
}

export class GeckoTerminalProvider implements DiscoveryProvider {
  id = 'geckoterminal';
  name = 'GeckoTerminal';

  async discover(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult(this.id);
    const enabled = new Set(ctx.settings.enabled_chains);
    const map = new Map<string, DiscoveredToken>();
    const base = baseUrl(ctx);
    const rate = ctx.geckoRateLimitPerMin ?? 5;
    const maxPages = Math.min(10, Math.max(1, ctx.settings.gecko_max_pages));
    const interval = Math.max(1, ctx.settings.discovery_interval_minutes || 3);
    // Budget GeckoTerminal calls per run and reserve one call for metadata updates.
    const budget = Math.max(2, Math.floor(rate * interval * 0.7));
    const discoverBudget = Math.max(1, budget - 1);
    const enabledChains = ctx.settings.enabled_chains.filter((c) => enabled.has(c));
    const rotationIndex = enabledChains.length ? Math.floor(Date.now() / (interval * 60000)) % enabledChains.length : 0;
    const rotatedChains = enabledChains.slice(rotationIndex).concat(enabledChains.slice(0, rotationIndex));
    const requests: string[] = [];
    if (ctx.settings.gecko_per_chain) {
      for (let page = 1; page <= maxPages; page++) {
        for (const chain of rotatedChains) {
          const cfg = getChain(chain);
          if (!cfg) continue;
          requests.push(`${base}/networks/${cfg.geckoNetwork}/new_pools?include=base_token,quote_token&page=${page}`);
        }
      }
    } else {
      for (let page = 1; page <= maxPages; page++) requests.push(`${base}/networks/new_pools?include=base_token,quote_token&page=${page}`);
      // Rotate one priority chain per run so global Solana-heavy feeds do not starve EVM chains.
      // Use gecko_per_chain=true for explicit multi-chain sweeps within the request budget.
      const rotationChain = rotatedChains[0];
      if (requests.length < discoverBudget && rotationChain) {
        const cfg = getChain(rotationChain);
        if (cfg) requests.push(`${base}/networks/${cfg.geckoNetwork}/new_pools?include=base_token,quote_token&page=1`);
      }
    }
    const planned = requests.slice(0, discoverBudget);
    result.stats.requestsPlanned = planned.length;
    result.stats.rotationChain = rotatedChains[0] ? 1 : 0;
    for (const url of planned) {
      try {
        const res = await fetchJson<GeckoResponse>(url, { provider: this.id, rateLimitPerMin: rate, headers: { Accept: accept(ctx), ...headers(ctx) }, cacheTtlMs: 60000, retries: 2 });
        const pools = Array.isArray(res.data) ? res.data : [res.data];
        const included = includedMap(res);
        result.stats.pools = (result.stats.pools ?? 0) + pools.length;
        if (pools.length === 0) break;
        for (const pool of pools) {
          const token = poolToToken(pool, included, enabled);
          if (!token) continue;
          const key = `${token.chain}:${addressKey(token.chain, token.address)}`;
          map.set(key, map.has(key) ? mergeToken(map.get(key)!, token) : token);
        }
      } catch (err) {
        result.errors.push({ provider: this.id, endpoint: url, message: err instanceof Error ? err.message : 'Unknown error', status: err instanceof HttpError ? err.status : undefined });
        break;
      }
    }
    result.tokens = [...map.values()];
    result.stats.tokens = result.tokens.length;
    return result;
  }

  async metadataUpdates(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult(this.id);
    const enabled = new Set(ctx.settings.enabled_chains);
    const url = `${baseUrl(ctx)}/tokens/info_recently_updated`;
    try {
      const res = await fetchJson<GeckoResponse>(url, { provider: this.id, rateLimitPerMin: ctx.geckoRateLimitPerMin ?? 5, headers: { Accept: accept(ctx), ...headers(ctx) }, cacheTtlMs: 120000, retries: 1 });
      const items = Array.isArray(res.data) ? res.data : [res.data];
      result.stats.metadataTokens = items.length;
      for (const item of items) {
        const token = metadataToToken(item, enabled);
        if (token) result.tokens.push(token);
      }
    } catch (err) {
      result.errors.push({ provider: this.id, endpoint: url, message: err instanceof Error ? err.message : 'Unknown error', status: err instanceof HttpError ? err.status : undefined });
    }
    return result;
  }
}
