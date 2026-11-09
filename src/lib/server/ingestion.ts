import { addressKey } from '@/lib/chains';
import { communityCandidatesFromLinks, dedupeRawLinks, primarySocialUrls } from '@/lib/community/extract';
import { validateCommunityLink } from '@/lib/community/validate';
import { getServerConfig } from '@/lib/config';
import { one, q } from '@/lib/db';
import {
  acquireLock, createJob, createNotification, finishJob, getApiSources, getJob, getSettings, lastJobCreatedAt,
  markJobRunning, nextQueuedJob, recoverStaleJobs, releaseLock, updateSourceHealth,
} from '@/lib/db/repository';
import { getProviders, mergeToken, type ProviderContext, type TokenRef } from '@/lib/providers';
import { DexScreenerProvider } from '@/lib/providers/dexscreener';
import { computeCommunityFlags, passesSettings, scoreProject } from '@/lib/qualification';
import type { CommunityLink, DiscoveredToken, DiscoveryJob, ProviderError, UserSettings } from '@/lib/types';
import { getProviderSecret } from './secrets';

interface UpsertStats { projectId: string; created: boolean; pairsUpserted: number; linksFound: number; linksValidated: number }

function log(logs: DiscoveryJob['logs'], level: string, message: string) {
  logs.push({ at: new Date().toISOString(), level, message });
}

async function upsertTokenAndProject(c: DiscoveredToken): Promise<{ projectId: string; tokenId: string; created: boolean }> {
  const key = addressKey(c.chain, c.address);
  const social = primarySocialUrls(c.links);
  const token = await one<any>(
    `INSERT INTO tokens (chain, contract_address, contract_address_key, name, symbol, decimals, image_url, description, coingecko_coin_id, gt_score, metadata_source, metadata_updated_at, last_metadata_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
     ON CONFLICT (chain, contract_address_key) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, tokens.name),
       symbol = COALESCE(EXCLUDED.symbol, tokens.symbol),
       decimals = COALESCE(EXCLUDED.decimals, tokens.decimals),
       image_url = COALESCE(EXCLUDED.image_url, tokens.image_url),
       description = COALESCE(EXCLUDED.description, tokens.description),
       coingecko_coin_id = COALESCE(EXCLUDED.coingecko_coin_id, tokens.coingecko_coin_id),
       gt_score = COALESCE(EXCLUDED.gt_score, tokens.gt_score),
       metadata_source = COALESCE(EXCLUDED.metadata_source, tokens.metadata_source),
       metadata_updated_at = COALESCE(EXCLUDED.metadata_updated_at, tokens.metadata_updated_at),
       last_metadata_at = now(), updated_at = now()
     RETURNING id, (xmax = 0) AS inserted`,
    [c.chain, c.address, key, c.name ?? null, c.symbol ?? null, c.decimals ?? null, c.imageUrl ?? null, c.description ?? null, c.coingeckoCoinId ?? null, c.gtScore ?? null, c.metadataSource ?? c.source, c.metadataUpdatedAt ?? null],
  );
  const project = await one<any>(
    `INSERT INTO projects (token_id, chain, contract_address, contract_address_key, name, symbol, description, website, twitter_url, telegram_url, discord_url, github_url, token_created_at, market_data_source, metadata_source, last_enriched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (chain, contract_address_key) DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, 'Unknown token'), projects.name),
       symbol = COALESCE(NULLIF(EXCLUDED.symbol, '?'), projects.symbol),
       description = COALESCE(EXCLUDED.description, projects.description),
       website = COALESCE(EXCLUDED.website, projects.website),
       twitter_url = COALESCE(EXCLUDED.twitter_url, projects.twitter_url),
       telegram_url = COALESCE(EXCLUDED.telegram_url, projects.telegram_url),
       discord_url = COALESCE(EXCLUDED.discord_url, projects.discord_url),
       github_url = COALESCE(EXCLUDED.github_url, projects.github_url),
       token_created_at = LEAST(COALESCE(projects.token_created_at, EXCLUDED.token_created_at), COALESCE(EXCLUDED.token_created_at, projects.token_created_at)),
       market_data_source = COALESCE(EXCLUDED.market_data_source, projects.market_data_source),
       metadata_source = COALESCE(EXCLUDED.metadata_source, projects.metadata_source),
       last_enriched_at = now(), updated_at = now()
     RETURNING id, (xmax = 0) AS inserted`,
    [token!.id, c.chain, c.address, key, c.name || 'Unknown token', c.symbol || '?', c.description ?? null, social.website, social.twitter_url, social.telegram_url, social.discord_url, social.github_url, c.tokenCreatedAt ?? null, c.marketDataSource ?? null, c.metadataSource ?? c.source],
  );
  return { projectId: project!.id, tokenId: token!.id, created: Boolean(project!.inserted) };
}

async function upsertPairs(projectId: string, c: DiscoveredToken): Promise<number> {
  let count = 0;
  for (const p of c.pairs) {
    const pairKey = addressKey(p.chain, p.pairAddress);
    await q(
      `INSERT INTO trading_pairs (project_id, chain, pair_address, pair_address_key, dex_id, base_token_address, quote_token_address, quote_symbol, price_usd, liquidity_usd, volume_24h_usd, transaction_count_24h, buys_24h, sells_24h, pair_created_at, fdv_usd, market_cap_usd, source, source_url, raw, last_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now())
       ON CONFLICT (chain, pair_address_key) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         dex_id = COALESCE(EXCLUDED.dex_id, trading_pairs.dex_id),
         base_token_address = COALESCE(EXCLUDED.base_token_address, trading_pairs.base_token_address),
         quote_token_address = COALESCE(EXCLUDED.quote_token_address, trading_pairs.quote_token_address),
         quote_symbol = COALESCE(EXCLUDED.quote_symbol, trading_pairs.quote_symbol),
         price_usd = COALESCE(EXCLUDED.price_usd, trading_pairs.price_usd),
         liquidity_usd = COALESCE(EXCLUDED.liquidity_usd, trading_pairs.liquidity_usd),
         volume_24h_usd = COALESCE(EXCLUDED.volume_24h_usd, trading_pairs.volume_24h_usd),
         transaction_count_24h = COALESCE(EXCLUDED.transaction_count_24h, trading_pairs.transaction_count_24h),
         buys_24h = COALESCE(EXCLUDED.buys_24h, trading_pairs.buys_24h),
         sells_24h = COALESCE(EXCLUDED.sells_24h, trading_pairs.sells_24h),
         pair_created_at = LEAST(COALESCE(trading_pairs.pair_created_at, EXCLUDED.pair_created_at), COALESCE(EXCLUDED.pair_created_at, trading_pairs.pair_created_at)),
         fdv_usd = COALESCE(EXCLUDED.fdv_usd, trading_pairs.fdv_usd),
         market_cap_usd = COALESCE(EXCLUDED.market_cap_usd, trading_pairs.market_cap_usd),
         source = EXCLUDED.source,
         source_url = COALESCE(EXCLUDED.source_url, trading_pairs.source_url),
         raw = EXCLUDED.raw,
         last_updated_at = now()`,
      [projectId, p.chain, p.pairAddress, pairKey, p.dexId ?? null, p.baseTokenAddress ?? null, p.quoteTokenAddress ?? null, p.quoteSymbol ?? null, p.priceUsd ?? null, p.liquidityUsd ?? null, p.volume24h ?? null, p.transactionCount24h ?? null, p.buys24h ?? null, p.sells24h ?? null, p.pairCreatedAt ?? null, p.fdvUsd ?? null, p.marketCapUsd ?? null, p.source, p.sourceUrl ?? null, JSON.stringify(p.raw ?? {})],
    );
    count++;
  }
  return count;
}

async function aggregateProject(projectId: string, c: DiscoveredToken) {
  const agg = await one<any>(
    `SELECT COUNT(*)::int AS pair_count, SUM(liquidity_usd) AS liquidity_usd, SUM(volume_24h_usd) AS volume_24h_usd,
      SUM(transaction_count_24h)::int AS transaction_count_24h, SUM(buys_24h)::int AS buys_24h, SUM(sells_24h)::int AS sells_24h,
      MIN(pair_created_at) AS earliest_pair
     FROM trading_pairs WHERE project_id = $1`, [projectId]);
  const primary = await one<any>(`SELECT pair_address, dex_id, price_usd, fdv_usd, market_cap_usd FROM trading_pairs WHERE project_id=$1 ORDER BY liquidity_usd DESC NULLS LAST, volume_24h_usd DESC NULLS LAST LIMIT 1`, [projectId]);
  await q(
    `UPDATE projects SET
      pair_count = $2,
      liquidity_usd = COALESCE($3, liquidity_usd),
      volume_24h_usd = COALESCE($4, volume_24h_usd),
      transaction_count_24h = COALESCE($5, transaction_count_24h),
      buys_24h = COALESCE($6, buys_24h),
      sells_24h = COALESCE($7, sells_24h),
      token_created_at = LEAST(COALESCE(token_created_at, $8), COALESCE($8, token_created_at)),
      primary_pair_address = COALESCE($9, primary_pair_address),
      primary_dex = COALESCE($10, primary_dex),
      price_usd = COALESCE($11, price_usd),
      fdv_usd = COALESCE($12, fdv_usd),
      market_cap_usd = COALESCE($13, market_cap_usd),
      market_data_source = COALESCE($14, market_data_source),
      last_market_update_at = CASE WHEN $2 > 0 THEN now() ELSE last_market_update_at END,
      updated_at = now()
     WHERE id = $1`,
    [projectId, agg?.pair_count ?? 0, agg?.liquidity_usd ?? null, agg?.volume_24h_usd ?? null, agg?.transaction_count_24h ?? null, agg?.buys_24h ?? null, agg?.sells_24h ?? null, agg?.earliest_pair ?? null, primary?.pair_address ?? null, primary?.dex_id ?? null, primary?.price_usd ?? null, primary?.fdv_usd ?? null, primary?.market_cap_usd ?? null, c.marketDataSource ?? null],
  );
}

async function upsertLinksAndCommunities(projectId: string, c: DiscoveredToken, settings: UserSettings, force = false): Promise<{ linksFound: number; linksValidated: number }> {
  const links = dedupeRawLinks(c.links);
  const linkIds = new Map<string, string>();
  for (const l of links) {
    const row = await one<any>(
      `INSERT INTO social_links (project_id, platform, url, label, source, source_kind, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (project_id, platform, url) DO UPDATE SET last_seen_at=now(), label=COALESCE(EXCLUDED.label, social_links.label), source=EXCLUDED.source, source_kind=EXCLUDED.source_kind
       RETURNING id`, [projectId, l.platform, l.url, l.label ?? null, l.source, l.sourceKind]);
    if (row) linkIds.set(`${l.platform}:${l.url}`, row.id);
  }
  const candidates = communityCandidatesFromLinks(links);
  const cfg = getServerConfig();
  let validated = 0;
  for (const cand of candidates) {
    const existing = await one<CommunityLink>(`SELECT * FROM community_links WHERE project_id=$1 AND platform=$2 AND normalized_url=$3`, [projectId, cand.platform, cand.normalizedUrl]);
    const ttlMs = settings.community_check_ttl_hours * 3600000;
    const stale = !existing?.last_checked_at || !existing.next_check_at || new Date(existing.next_check_at).getTime() <= Date.now();
    let result;
    if (force || !existing || stale) {
      result = await validateCommunityLink({ platform: cand.platform, normalized_url: cand.normalizedUrl }, settings.community_check_ttl_hours, { publicPageChecks: cfg.telegramPublicPageChecks, discordChecks: cfg.discordInviteChecks });
      if (result.verification_method !== 'url_pattern') validated++;
    } else {
      result = {
        community_type: existing.community_type,
        validation_status: existing.validation_status,
        verification_method: existing.verification_method ?? cand.verificationMethod,
        is_verified: existing.is_verified,
        member_count: existing.member_count,
        title: existing.title,
        error: existing.error,
        raw_evidence: existing.raw_evidence,
      };
    }
    const socialLinkId = linkIds.get(`${cand.platform}:${cand.url}`) ?? existing?.social_link_id ?? null;
    await q(
      `INSERT INTO community_links (project_id, social_link_id, platform, url, normalized_url, community_type, validation_status, verification_method, is_verified, member_count, title, invite_code, last_checked_at, next_check_at, error, raw_evidence, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now() + ($13 * interval '1 hour'),$14,$15,now())
       ON CONFLICT (project_id, platform, normalized_url) DO UPDATE SET
         social_link_id = COALESCE(EXCLUDED.social_link_id, community_links.social_link_id),
         url = EXCLUDED.url,
         community_type = EXCLUDED.community_type,
         validation_status = EXCLUDED.validation_status,
         verification_method = EXCLUDED.verification_method,
         is_verified = EXCLUDED.is_verified,
         member_count = COALESCE(EXCLUDED.member_count, community_links.member_count),
         title = COALESCE(EXCLUDED.title, community_links.title),
         invite_code = COALESCE(EXCLUDED.invite_code, community_links.invite_code),
         last_checked_at = EXCLUDED.last_checked_at,
         next_check_at = EXCLUDED.next_check_at,
         error = EXCLUDED.error,
         raw_evidence = EXCLUDED.raw_evidence,
         updated_at = now()`,
      [projectId, socialLinkId, cand.platform, cand.url, cand.normalizedUrl, result.community_type, result.validation_status, result.verification_method, result.is_verified, result.member_count, result.title, cand.inviteCode, settings.community_check_ttl_hours, result.error, JSON.stringify(result.raw_evidence ?? {})],
    );
  }
  return { linksFound: links.length, linksValidated: validated };
}

async function recomputeQualification(projectId: string, settings: UserSettings, created: boolean) {
  const project = await one<any>(`SELECT p.*, t.image_url FROM projects p LEFT JOIN tokens t ON t.id=p.token_id WHERE p.id=$1`, [projectId]);
  if (!project) return;
  const links = (await q(`SELECT * FROM community_links WHERE project_id=$1`, [projectId])).map((r: any) => ({ ...r, is_verified: Boolean(r.is_verified), raw_evidence: r.raw_evidence ?? {} })) as CommunityLink[];
  const flags = computeCommunityFlags(links, settings);
  const bestTelegram = links.filter((l) => l.platform === 'telegram').sort((a, b) => rankCommunity(b) - rankCommunity(a))[0];
  const bestDiscord = links.filter((l) => l.platform === 'discord').sort((a, b) => rankCommunity(b) - rankCommunity(a))[0];
  const { score, reasons } = scoreProject({
    token_created_at: project.token_created_at,
    liquidity_usd: project.liquidity_usd === null ? null : Number(project.liquidity_usd),
    volume_24h_usd: project.volume_24h_usd === null ? null : Number(project.volume_24h_usd),
    transaction_count_24h: project.transaction_count_24h,
    website: project.website,
    twitter_url: project.twitter_url,
    github_url: project.github_url,
    description: project.description,
    image_url: project.image_url,
    communityLinks: links,
  });
  const check = passesSettings({ ...project, qualification_score: score } as any, flags, settings);
  await q(
    `UPDATE projects SET qualification_score=$2, qualification_reasons=$3, is_qualified=$4, has_telegram_group=$5, has_discord_server=$6, has_accessible_community=$7,
      telegram_url=COALESCE($8, telegram_url), discord_url=COALESCE($9, discord_url), data_flags=$10, updated_at=now() WHERE id=$1`,
    [projectId, score, JSON.stringify(reasons), check.passes, flags.has_telegram_group, flags.has_discord_server, flags.has_accessible_community, bestTelegram?.normalized_url ?? null, bestDiscord?.normalized_url ?? null, JSON.stringify({ filter_failures: check.failures, community_requirement: settings.community_requirement, telegram_verified: flags.telegram_verified, discord_verified: flags.discord_verified })],
  );
  if (created && settings.notifications_enabled) {
    if (check.passes && settings.notify_qualified) {
      await createNotification({ project_id: projectId, type: 'qualified', title: `Qualified lead: ${project.name} (${project.symbol})`, body: `Score ${score}/100 on ${project.chain}. ${flags.has_telegram_group ? 'Telegram group detected. ' : ''}${flags.has_discord_server ? 'Discord server detected.' : ''}` });
    }
    if (flags.has_telegram_group && flags.has_discord_server && settings.notify_both_communities) {
      await createNotification({ project_id: projectId, type: 'both_communities', title: `Dual community: ${project.name}`, body: 'Project has both an accessible Telegram group and a Discord server invitation.' });
    }
  }
}

function rankCommunity(l: CommunityLink): number {
  let r = 0;
  if (l.community_type === 'group' || l.community_type === 'server') r += 10;
  if (l.validation_status === 'verified') r += 5;
  else if (l.validation_status === 'accessible') r += 3;
  else if (l.validation_status === 'unverified') r += 1;
  if (l.is_verified) r += 2;
  return r;
}

export async function upsertCandidate(c: DiscoveredToken, settings: UserSettings, forceCommunityCheck = false): Promise<UpsertStats> {
  const { projectId, created } = await upsertTokenAndProject(c);
  const pairsUpserted = await upsertPairs(projectId, c);
  await aggregateProject(projectId, c);
  const { linksFound, linksValidated } = await upsertLinksAndCommunities(projectId, c, settings, forceCommunityCheck);
  await recomputeQualification(projectId, settings, created);
  return { projectId, created, pairsUpserted, linksFound, linksValidated };
}

export async function runDiscoveryJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const started = Date.now();
  const logs: DiscoveryJob['logs'] = [];
  const errors: ProviderError[] = [];
  const providerStats: Record<string, unknown> = {};
  let projectsCreated = 0, projectsUpdated = 0, pairsUpserted = 0, linksFound = 0, linksValidated = 0;
  await markJobRunning(jobId);
  try {
    const settings = await getSettings();
    const sources = await getApiSources();
    const enabledSources = new Set(sources.filter((s) => s.enabled).map((s) => s.id));
    const cfg = getServerConfig();
    const ctx: ProviderContext = {
      settings,
      geckoApiKey: await getProviderSecret('coingecko'),
      geckoUsePaid: cfg.geckoUsePaid,
      geckoRateLimitPerMin: cfg.geckoUsePaid ? Math.max(cfg.geckoRateLimitPerMin, 100) : cfg.geckoRateLimitPerMin,
      dexRateLimitPerMin: cfg.dexRateLimitPerMin,
    };
    const candidates = new Map<string, DiscoveredToken>();
    const merge = (t: DiscoveredToken) => {
      const key = `${t.chain}:${addressKey(t.chain, t.address)}`;
      candidates.set(key, candidates.has(key) ? mergeToken(candidates.get(key)!, t) : t);
    };
    for (const provider of getProviders()) {
      if (!enabledSources.has(provider.id)) { log(logs, 'info', `Skipping disabled provider ${provider.id}`); continue; }
      const res = await provider.discover(ctx);
      res.tokens.forEach(merge);
      errors.push(...res.errors);
      providerStats[provider.id] = { ...res.stats, errors: res.errors.length };
      await updateSourceHealth(provider.id, { health_status: res.errors.length === 0 ? 'healthy' : res.tokens.length > 0 ? 'degraded' : 'down', success: res.errors.length === 0, last_error: res.errors[0]?.message ?? null, last_status_code: res.errors[0]?.status ?? null });
      log(logs, res.errors.length ? 'warn' : 'info', `${provider.name}: ${res.tokens.length} candidates, ${res.errors.length} errors`);
      if (provider.metadataUpdates) {
        const meta = await provider.metadataUpdates(ctx);
        errors.push(...meta.errors);
        providerStats[`${provider.id}_metadata`] = { ...meta.stats, errors: meta.errors.length };
        // Merge metadata into current candidates; for existing projects only, refresh metadata without creating old metadata-only projects.
        const metaKeys = meta.tokens.map((t) => addressKey(t.chain, t.address));
        const existing = metaKeys.length ? await q<{ chain: string; contract_address_key: string }>(`SELECT chain, contract_address_key FROM projects WHERE chain = ANY($1) AND contract_address_key = ANY($2)`, [settings.enabled_chains, metaKeys]) : [];
        const existingSet = new Set(existing.map((r) => `${r.chain}:${r.contract_address_key}`));
        for (const t of meta.tokens) {
          const key = `${t.chain}:${addressKey(t.chain, t.address)}`;
          if (candidates.has(key) || existingSet.has(key)) merge(t);
        }
        log(logs, 'info', `${provider.name} metadata: ${meta.tokens.length} tokens, ${meta.errors.length} errors`);
      }
    }

    // Incrementally refresh stale existing projects (bounded per run).
    const stale = await q<any>(`SELECT chain, contract_address AS address FROM projects WHERE last_market_update_at IS NULL OR last_market_update_at < now() - interval '30 minutes' ORDER BY last_market_update_at ASC NULLS FIRST LIMIT 90`);
    const refs: TokenRef[] = [];
    const seen = new Set<string>();
    for (const t of candidates.values()) {
      const key = `${t.chain}:${addressKey(t.chain, t.address)}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ chain: t.chain, address: t.address }); }
    }
    for (const s of stale) {
      const key = `${s.chain}:${addressKey(s.chain, s.address)}`;
      if (!seen.has(key)) { seen.add(key); refs.push({ chain: s.chain, address: s.address }); }
    }
    if (enabledSources.has('dexscreener') && refs.length) {
      const dex = new DexScreenerProvider();
      const enriched = await dex.enrich(refs, ctx);
      enriched.tokens.forEach(merge);
      errors.push(...enriched.errors);
      providerStats.dexscreener_enrich = { ...enriched.stats, errors: enriched.errors.length };
      log(logs, enriched.errors.length ? 'warn' : 'info', `DEX enrichment: ${enriched.tokens.length} tokens enriched, ${enriched.errors.length} errors`);
    }

    log(logs, 'info', `Upserting ${candidates.size} consolidated projects`);
    for (const c of candidates.values()) {
      try {
        const stats = await upsertCandidate(c, settings);
        if (stats.created) projectsCreated++; else projectsUpdated++;
        pairsUpserted += stats.pairsUpserted;
        linksFound += stats.linksFound;
        linksValidated += stats.linksValidated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown upsert error';
        errors.push({ provider: 'pipeline', message: `${c.chain}:${c.address} ${message}` });
        log(logs, 'error', `Failed to upsert ${c.chain}:${c.address}: ${message}`);
      }
    }
    const status = errors.length ? 'completed_with_errors' : 'completed';
    await finishJob(jobId, { status, duration_ms: Date.now() - started, projects_created: projectsCreated, projects_updated: projectsUpdated, pairs_upserted: pairsUpserted, links_found: linksFound, links_validated: linksValidated, provider_stats: { ...providerStats, errors }, logs, error: errors.length ? errors.slice(0, 5).map((e) => `${e.provider}: ${e.message}`).join('; ') : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error';
    log(logs, 'error', message);
    await finishJob(jobId, { status: 'failed', duration_ms: Date.now() - started, error: message, logs, provider_stats: providerStats, projects_created: projectsCreated, projects_updated: projectsUpdated, pairs_upserted: pairsUpserted, links_found: linksFound, links_validated: linksValidated });
  }
}

export async function recomputeProjectQualification(projectId: string) {
  const settings = await getSettings();
  await recomputeQualification(projectId, settings, false);
}

export async function processWorkerTick(owner: string): Promise<{ ran: boolean; jobId?: string }> {
  await recoverStaleJobs();
  const locked = await acquireLock('discovery', 1800, owner);
  if (!locked) return { ran: false };
  try {
    let job = await nextQueuedJob();
    if (!job) {
      const settings = await getSettings();
      const last = await lastJobCreatedAt();
      const due = !last || Date.now() - new Date(last).getTime() >= settings.discovery_interval_minutes * 60000;
      if (due) job = await createJob('scheduled');
    }
    if (!job) return { ran: false };
    console.log(`[worker] starting discovery job ${job.id} (${job.trigger_source})`);
    await runDiscoveryJob(job.id);
    return { ran: true, jobId: job.id };
  } finally {
    await releaseLock('discovery');
  }
}
