import { addressKey, chainFromDexId, getChain, isValidAddress } from '@/lib/chains';
import { classifyPlatform, dedupeRawLinks, linksFromText, telegramHandleToUrl, twitterHandleToUrl } from '@/lib/community/extract';
import { fetchJson, HttpError } from '@/lib/server/http';
import type { ChainId, DiscoveredToken, PairSnapshot, ProviderResult, RawLink } from '@/lib/types';
import { chunk, toNumber } from '@/lib/utils';
import { emptyResult, mergeToken, type DiscoveryProvider, type ProviderContext, type TokenRef } from './types';

const BASE = 'https://api.dexscreener.com';

interface DexProfile {
  url?: string;
  chainId?: string;
  tokenAddress?: string;
  icon?: string;
  header?: string;
  description?: string | null;
  links?: Array<{ type?: string; label?: string; url?: string }>;
}

interface DexPair {
  chainId: string;
  dexId?: string;
  url?: string;
  pairAddress: string;
  baseToken: { address: string; name?: string; symbol?: string };
  quoteToken?: { address?: string | null; name?: string | null; symbol?: string | null };
  priceUsd?: string | null;
  txns?: Record<string, { buys?: number; sells?: number }>;
  volume?: Record<string, number>;
  liquidity?: { usd?: number | null; base?: number; quote?: number } | null;
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  info?: {
    imageUrl?: string | null;
    websites?: Array<{ url?: string; label?: string }>;
    socials?: Array<{ platform?: string; type?: string; handle?: string; url?: string }>;
  } | null;
}

function profileLinks(profile: DexProfile): RawLink[] {
  const links: RawLink[] = [];
  for (const l of profile.links ?? []) {
    if (!l.url) continue;
    const platform = (l.type && ['telegram', 'discord', 'twitter', 'github', 'website', 'docs'].includes(l.type) ? l.type : classifyPlatform(l.url)) as RawLink['platform'];
    links.push({ platform, url: l.url, label: l.label, source: 'dexscreener', sourceKind: 'api' });
  }
  links.push(...linksFromText(profile.description, 'dexscreener'));
  return dedupeRawLinks(links);
}

function pairLinks(pair: DexPair): RawLink[] {
  const links: RawLink[] = [];
  for (const w of pair.info?.websites ?? []) {
    if (w.url) links.push({ platform: classifyPlatform(w.url), url: w.url, label: w.label, source: 'dexscreener', sourceKind: 'api' });
  }
  for (const s of pair.info?.socials ?? []) {
    const platform = (s.platform || s.type || '').toLowerCase();
    let url = s.url || '';
    if (!url && s.handle) {
      if (platform === 'telegram') url = telegramHandleToUrl(s.handle) || '';
      else if (platform === 'twitter') url = twitterHandleToUrl(s.handle) || '';
      else if (platform === 'discord') url = s.handle.startsWith('http') ? s.handle : `https://discord.gg/${s.handle}`;
      else if (platform === 'github') url = s.handle.startsWith('http') ? s.handle : `https://github.com/${s.handle}`;
    }
    if (!url) continue;
    const p = (['telegram', 'discord', 'twitter', 'github'].includes(platform) ? platform : classifyPlatform(url)) as RawLink['platform'];
    links.push({ platform: p, url, source: 'dexscreener', sourceKind: 'api' });
  }
  return dedupeRawLinks(links);
}

function normalizePair(pair: DexPair): { chain: ChainId; snapshot: PairSnapshot } | null {
  const chain = chainFromDexId(pair.chainId);
  if (!chain || !pair.pairAddress) return null;
  const tx = pair.txns?.h24;
  const buys = tx?.buys ?? null;
  const sells = tx?.sells ?? null;
  return {
    chain,
    snapshot: {
      chain,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId ?? null,
      baseTokenAddress: pair.baseToken?.address ?? null,
      quoteTokenAddress: pair.quoteToken?.address ?? null,
      quoteSymbol: pair.quoteToken?.symbol ?? null,
      priceUsd: toNumber(pair.priceUsd),
      liquidityUsd: pair.liquidity?.usd ?? null,
      volume24h: toNumber(pair.volume?.h24),
      transactionCount24h: buys !== null || sells !== null ? (buys ?? 0) + (sells ?? 0) : null,
      buys24h: buys,
      sells24h: sells,
      pairCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null,
      fdvUsd: pair.fdv ?? null,
      marketCapUsd: pair.marketCap ?? null,
      source: 'dexscreener',
      sourceUrl: pair.url ?? null,
      raw: pair as unknown as Record<string, unknown>,
    },
  };
}

export class DexScreenerProvider implements DiscoveryProvider {
  id = 'dexscreener';
  name = 'DEX Screener';

  async discover(ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult(this.id);
    const enabled = new Set(ctx.settings.enabled_chains);
    const map = new Map<string, DiscoveredToken>();
    const endpoints = [
      { url: `${BASE}/token-profiles/latest/v1`, ttl: 60000 },
      { url: `${BASE}/token-profiles/recent-updates/v1`, ttl: 300000 },
    ];
    for (const ep of endpoints) {
      try {
        const profiles = await fetchJson<DexProfile[]>(ep.url, {
          provider: this.id,
          rateLimitPerMin: ctx.dexRateLimitPerMin ?? 50,
          cacheTtlMs: ep.ttl,
          retries: 2,
        });
        result.stats.profiles = (result.stats.profiles ?? 0) + (Array.isArray(profiles) ? profiles.length : 0);
        for (const p of Array.isArray(profiles) ? profiles : []) {
          if (!p.chainId || !p.tokenAddress) continue;
          const chain = chainFromDexId(p.chainId);
          if (!chain || !enabled.has(chain) || !isValidAddress(chain, p.tokenAddress)) continue;
          const key = `${chain}:${addressKey(chain, p.tokenAddress)}`;
          const token: DiscoveredToken = {
            chain,
            address: p.tokenAddress,
            imageUrl: p.icon ?? null,
            description: p.description ?? null,
            pairs: [],
            links: profileLinks(p),
            source: this.id,
            metadataSource: this.id,
          };
          map.set(key, map.has(key) ? mergeToken(map.get(key)!, token) : token);
        }
      } catch (err) {
        result.errors.push({ provider: this.id, endpoint: ep.url, message: err instanceof Error ? err.message : 'Unknown error', status: err instanceof HttpError ? err.status : undefined });
      }
    }
    result.tokens = [...map.values()];
    result.stats.tokens = result.tokens.length;
    return result;
  }

  async enrich(tokens: TokenRef[], ctx: ProviderContext): Promise<ProviderResult> {
    const result = emptyResult(this.id);
    const enabled = new Set(ctx.settings.enabled_chains);
    const byChain = new Map<ChainId, TokenRef[]>();
    for (const t of tokens) {
      if (!enabled.has(t.chain) || !isValidAddress(t.chain, t.address)) continue;
      const arr = byChain.get(t.chain) ?? [];
      arr.push(t);
      byChain.set(t.chain, arr);
    }
    const map = new Map<string, DiscoveredToken>();
    const batchSize = ctx.settings.dex_enrichment_batch_size || 30;
    for (const [chain, refs] of byChain) {
      const cfg = getChain(chain)!;
      for (const batch of chunk(refs, batchSize)) {
        const addresses = batch.map((r) => r.address).join(',');
        const url = `${BASE}/tokens/v1/${cfg.dexChainId}/${addresses}`;
        try {
          const pairs = await fetchJson<DexPair[]>(url, { provider: this.id, rateLimitPerMin: ctx.dexRateLimitPerMin ?? 50, cacheTtlMs: 30000, retries: 2 });
          result.stats.pairRequests = (result.stats.pairRequests ?? 0) + 1;
          const list = Array.isArray(pairs) ? pairs : [];
          result.stats.pairs = (result.stats.pairs ?? 0) + list.length;
          for (const ref of batch) {
            const refKey = addressKey(chain, ref.address);
            const matching = list.filter((p) => {
              const base = p.baseToken?.address ? addressKey(chain, p.baseToken.address) : null;
              const quote = p.quoteToken?.address ? addressKey(chain, p.quoteToken.address) : null;
              return base === refKey || quote === refKey;
            });
            if (matching.length === 0) continue;
            const snapshots: PairSnapshot[] = [];
            let links: RawLink[] = [];
            let name: string | null = null;
            let symbol: string | null = null;
            let imageUrl: string | null = null;
            let earliest: string | null = null;
            for (const p of matching) {
              const norm = normalizePair(p);
              if (!norm) continue;
              snapshots.push(norm.snapshot);
              links = dedupeRawLinks([...links, ...pairLinks(p)]);
              const baseKey = p.baseToken?.address ? addressKey(chain, p.baseToken.address) : null;
              const tokenSide = baseKey === refKey ? p.baseToken : p.quoteToken;
              name = name || tokenSide?.name || null;
              symbol = symbol || tokenSide?.symbol || null;
              imageUrl = imageUrl || p.info?.imageUrl || null;
              if (norm.snapshot.pairCreatedAt && (!earliest || norm.snapshot.pairCreatedAt < earliest)) earliest = norm.snapshot.pairCreatedAt;
            }
            if (snapshots.length === 0) continue;
            const key = `${chain}:${refKey}`;
            const token: DiscoveredToken = {
              chain,
              address: ref.address,
              name,
              symbol,
              imageUrl,
              tokenCreatedAt: earliest,
              pairs: snapshots,
              links,
              source: this.id,
              marketDataSource: this.id,
              metadataSource: this.id,
            };
            map.set(key, map.has(key) ? mergeToken(map.get(key)!, token) : token);
          }
        } catch (err) {
          result.errors.push({ provider: this.id, endpoint: url, message: err instanceof Error ? err.message : 'Unknown error', status: err instanceof HttpError ? err.status : undefined });
        }
      }
    }
    result.tokens = [...map.values()];
    result.stats.tokens = result.tokens.length;
    return result;
  }
}
