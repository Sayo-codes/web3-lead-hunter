# Architecture — Web3 Lead Hunter

## Goal

Automated discovery of early-stage Web3 projects, extraction of social/community links, transparent qualification, and a human-reviewed outreach CRM. No automated unsolicited bulk messaging, no auto-joining communities, no anti-spam bypass.

## Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn-style Radix UI components, Lucide icons, SWR.
- Backend: Next.js Route Handlers (Node runtime) + TypeScript background worker.
- Database: Supabase PostgreSQL in production. Zero-config local development/preview uses PGlite (real PostgreSQL WASM) with the same SQL schema and repository layer. No fake production data.
- Auth: Supabase Auth in production (single-owner allowlist). Local PGlite mode runs as a local development owner.
- Providers: DEX Screener, GeckoTerminal, Discord invite API, optional Telegram Bot API/public page checks.

## Runtime modes

### Local / preview (`DB_MODE=pglite`)

- Next.js instrumentation starts an in-process worker.
- PGlite persists to `.data/pglite`.
- Real provider APIs are called. CRM, settings, jobs, notifications are fully functional.
- Intended for development and preview, not multi-instance production.

### Production (`DB_MODE=supabase` or `SUPABASE_DB_URL` set)

- Run `npm run db:migrate` against Supabase Postgres.
- Run Next.js (`npm run start`) and a dedicated worker (`npm run worker`) separately.
- Supabase Auth protects UI/API. Direct Postgres access is server-side only.
- RLS denies direct anon/authenticated PostgREST table access; the app authorizes at the API layer and uses a server-side DB connection.

## Ingestion pipeline

1. Load settings and provider health.
2. Acquire a DB-backed worker lock to prevent overlapping runs.
3. Create a `discovery_jobs` row (`queued` -> `running`).
4. Discover candidates:
   - GeckoTerminal global `new_pools` pages (configurable, default 1) -> new pool/token candidates with market data and `pool_created_at`.
   - DEX Screener latest token profiles -> metadata/link candidates.
   - DEX Screener recent profile updates -> incremental metadata refresh (cached/skipped when unchanged).
5. Normalize and dedupe by `(chain, contract_address_key)`:
   - EVM addresses lowercased.
   - Solana addresses preserved as returned by providers.
   - Multiple pairs consolidate into one project; pair rows are retained.
6. Enrich missing/stale market data via DEX Screener `/tokens/v1/{chain}/{addresses}` in batches of up to 30.
7. Merge GeckoTerminal `info_recently_updated` metadata when it matches discovered tokens.
8. Extract social/community links from provider metadata and descriptions:
   - website, X/Twitter, GitHub, Telegram, Discord, docs.
   - Telegram handles -> `t.me` URLs.
   - Discord invites -> normalized invite URLs.
9. Validate community links with TTL caching:
   - Discord invite API.
   - Telegram Bot API if configured and permitted.
   - Optional public Telegram page hint.
   - Never join, never bypass restrictions.
10. Upsert tokens, projects, trading_pairs, social_links, community_links.
11. Recompute transparent qualification score and reasons.
12. Create in-dashboard notifications for newly qualified / dual-community projects.
13. Record provider stats, errors, duration, and job status. Provider failure does not stop other providers.

## Scheduling and rate limits

- Default discovery interval: 3 minutes (configurable 1–1440).
- Conservative keyless defaults: GeckoTerminal 5 req/min, 1 global page; DEX Screener 50 req/min (below documented 60/300 limits).
- Retry with exponential backoff and `Retry-After` support.
- Request deduplication and in-memory response cache per run.
- Community checks cached by `community_check_ttl_hours` (default 6h).
- Stale `running` jobs are recovered on worker startup.

## Qualification engine

Score 0–100 with explicit reasons. Signals:

- Age recency (earliest known pair creation; unknown age is penalized but not hidden by default).
- Liquidity (min/max configurable).
- 24h volume and transaction activity (activity is not treated as proof of service need).
- Accessible Telegram group / Discord server.
- Website, X/Twitter, GitHub, description completeness.
- Configurable minimum score and community requirement.

The UI shows each reason and point contribution. High volume alone does not qualify a lead.

## Outreach safety

- Prospect statuses: New Lead, Reviewed, Ready to Contact, Contacted, Replied, Interested, Negotiating, Client, Not Interested.
- Message templates are interpolated locally from project facts and the owner's services.
- Messages are editable. The app only opens external links or copies text; it never sends DMs automatically.
- Duplicate-contact protection warns/blocks repeated contact logging within a configurable window and records outreach history.

## Extensibility

Providers implement `DiscoveryProvider`:

```ts
interface DiscoveryProvider {
  id: string;
  discover(ctx: ProviderContext): Promise<ProviderResult>;
  enrich?(tokens: TokenRef[], ctx: ProviderContext): Promise<ProviderResult>;
}
```

Add a provider by implementing the interface and registering it in `src/lib/providers/index.ts`. Normalized candidates flow through the same dedupe, link extraction, validation, qualification, and persistence pipeline.
