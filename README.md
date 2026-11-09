# Web3 Lead Hunter

Automated Web3 project discovery and **human-reviewed** client prospecting platform for a full-stack blockchain developer.

It discovers newly available tokens / trading pairs, extracts social and community links, identifies Telegram groups and Discord server invitations where permitted, scores qualified prospects transparently, and provides an outreach CRM. It does **not** send automated unsolicited bulk DMs, auto-join Telegram/Discord communities, or bypass anti-spam protections.

> Production data is never faked. The local preview uses real DEX Screener / GeckoTerminal responses. Unavailable fields are stored as `NULL` and shown as “Unavailable”.

---

## What is implemented

### Automated discovery
- GeckoTerminal `new_pools` discovery (global by default, plus one rotating priority chain per run; optional explicit per-chain sweeps).
- DEX Screener latest / recently updated token profiles.
- DEX Screener batched token/pair enrichment (up to 30 addresses per request).
- GeckoTerminal recently updated token metadata merged into discovered/existing projects.
- Incremental refresh of stale existing projects (bounded per run).
- Multi-chain support: Ethereum, Base, Solana, BNB Chain, Arbitrum, Optimism, Polygon, Avalanche.
- Dedupe by `(chain, contract_address_key)`; multiple pairs consolidate into one project while retaining pair rows.
- Configurable schedule (default 3 minutes), rate limiting, retries, backoff, `Retry-After`, request dedupe, caching, job logs, failed-job recovery.

### Community extraction & verification
- Extracts website, X/Twitter, GitHub, Telegram, Discord, docs from provider metadata and descriptions.
- Telegram formats: `t.me/name`, `telegram.me/name`, `t.me/+CODE`, `t.me/joinchat/CODE`, `telegram.me/joinchat/CODE`.
- Discord formats: `discord.gg/CODE`, `discord.com/invite/CODE`, `discordapp.com/invite/CODE`.
- Discord invite validation via official Discord invite API (no joining, no user tokens).
- Telegram verification layers:
  1. URL pattern classification (private invite vs public username).
  2. Optional Telegram Bot API `getChat` **only if the bot already has access**.
  3. Optional public `t.me` page hint (`members` vs `subscribers`) — labeled as a hint, **not** bot-verified.
- Private Telegram invites are not auto-joined and are not claimed to be groups unless verified.
- Community filters: Telegram group only, Discord server only, both, either, any. Default: accessible Telegram group **or** Discord server.

### Qualification engine
Transparent 0–100 score with explicit reasons:
- recency (earliest known pair creation; unknown age is not fabricated),
- liquidity,
- 24h volume / transactions (activity is not treated as proof of service need),
- accessible Telegram group / validated Discord server,
- website / X / GitHub / description / image completeness.

Configurable min/max liquidity, volume, transactions, max age, minimum score, community requirement.

### Dashboard
- Overview cards: total, new today, Telegram groups, Discord servers, both, qualified, awaiting review, contacted.
- Modern dark responsive table with token, chain, contract, age, liquidity, volume, txns, website, X, Telegram, Discord, discovered time, score, actions.
- Advanced filters + search + sorting + pagination.
- Project details: overview, community, pairs, outreach CRM, data provenance.
- Safe external links (`target=_blank rel=noopener noreferrer`), copy contract, mark reviewed, add to prospects, record contacted.
- In-dashboard notifications; designed for future email/Telegram notification channels.

### Outreach CRM
- Prospect statuses: New Lead, Reviewed, Ready to Contact, Contacted, Replied, Interested, Negotiating, Client, Not Interested.
- Notes, contact platform, contacted date, response notes, opportunity outcome, follow-up.
- Message templates with variable interpolation and editable drafts.
- Duplicate-contact protection window.
- Human-reviewed workflow only: generate → edit → copy/open permitted channel → record interaction.

### Settings & system
- Discovery frequency, chains, qualification filters, community requirements, refresh, notifications, owner services.
- Provider enable/disable and health.
- Optional encrypted UI secret storage (AES-256-GCM) or server environment variables.
- Discovery job history, logs, provider stats, manual run.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn-style Radix UI, Lucide, SWR |
| Backend | Next.js Route Handlers (Node runtime), TypeScript worker |
| Database | Supabase PostgreSQL (production). PGlite (real Postgres WASM) for zero-config local/preview |
| Auth | Supabase Auth + single-owner allowlist in production; local dev owner in PGlite mode |
| Providers | DEX Screener, GeckoTerminal, Discord invite API, optional Telegram Bot API / public page hints |

See `docs/API_RESEARCH.md` for exact endpoints, fields, rate limits, and limitations. See `docs/ARCHITECTURE.md` for pipeline design.

---

## Quick start (local / preview)

Requires Node.js >= 20.11.

```bash
npm install
cp .env.example .env.local   # optional; defaults work for local PGlite mode
npm run dev
```

Open http://localhost:3000.

Local mode:
- uses PGlite persisted in `.data/pglite`,
- starts an in-process worker when the app/API is first loaded,
- calls real provider APIs,
- requires no API keys,
- is intended for development/preview, **not** multi-instance production.

Useful commands:

```bash
npm run dev          # Next.js + local in-process worker
npm test             # unit/schema/provider/verification/filter tests (no live API calls by default)
npm run test:live    # opt-in live provider smoke tests
npm run typecheck
npm run build
npm run db:migrate   # apply migrations to configured DB
npm run worker       # dedicated worker (recommended for Supabase production)
```

---

## Production setup with Supabase

### 1. Create Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Enable **Email** auth provider. Create your owner user (or allow sign-up and confirm email).
3. Get:
   - Project URL: `NEXT_PUBLIC_SUPABASE_URL`
   - Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Postgres connection string: `SUPABASE_DB_URL` (Settings → Database → Connection string URI). Use direct or session pooler connection.

### 2. Configure environment

```env
DB_MODE=supabase
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
OWNER_EMAIL=you@example.com

# Optional but recommended for production GeckoTerminal throughput
GECKO_USE_PAID=true
COINGECKO_API_KEY=[COINGECKO_KEY]

# Optional Telegram bot verification (bot must already have access; never auto-joins)
TELEGRAM_BOT_TOKEN=[BOT_TOKEN]

# Optional encrypted UI secret storage
SECRETS_ENCRYPTION_KEY=[32-byte hex, e.g. openssl rand -hex 32]
```

Never expose `SUPABASE_DB_URL`, `COINGECKO_API_KEY`, `TELEGRAM_BOT_TOKEN`, or `SECRETS_ENCRYPTION_KEY` to frontend code.

### 3. Migrate

```bash
npm run db:migrate
```

This applies:
- `202611080001_core.sql` — tables, indexes, constraints
- `202611080002_seed.sql` — provider registry, default settings, message templates (no project data)
- `202611080003_rls.sql` — Supabase RLS hardening (deny direct anon/authenticated PostgREST access)

Alternatively use Supabase CLI / SQL editor with the files in `supabase/migrations`.

### 4. Run web + worker

```bash
npm run build
npm run start        # web, port 3000
# separate process / service:
npm run worker
```

In Supabase mode the web app does **not** run the in-process worker. Run `npm run worker` as a dedicated always-on process. The worker acquires a DB lock, processes queued jobs, and creates scheduled jobs based on settings.

---

## Environment variables

See `.env.example` for the full list.

| Variable | Required | Purpose |
|---|---:|---|
| `DB_MODE` | no | `pglite` (default) or `supabase`. Auto-supabase if `SUPABASE_DB_URL` set. |
| `PGLITE_DATA_DIR` | no | Local PGlite data directory. |
| `SUPABASE_DB_URL` | production | Server-side Postgres connection string. |
| `NEXT_PUBLIC_SUPABASE_URL` | production auth | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production auth | Supabase anon key (public, auth only). |
| `OWNER_EMAIL` | recommended | Restrict single-owner API access. |
| `DISCOVERY_INTERVAL_MINUTES` | no | Default schedule fallback (settings override). |
| `WORKER_POLL_SECONDS` | no | Worker queue poll interval. |
| `GECKO_RATE_LIMIT_PER_MIN` | no | Conservative keyless default 5. |
| `DEXSCREENER_RATE_LIMIT_PER_MIN` | no | Default 50 (below documented limits). |
| `GECKO_USE_PAID` / `COINGECKO_API_KEY` | optional | Paid CoinGecko onchain access for production throughput. |
| `TELEGRAM_BOT_TOKEN` | optional | Verify chats the bot already can access. |
| `TELEGRAM_PUBLIC_PAGE_CHECKS` | no | Public t.me group/channel hints (default true). |
| `DISCORD_INVITE_CHECKS` | no | Official Discord invite validation (default true). |
| `SECRETS_ENCRYPTION_KEY` | optional | Enables encrypted UI-managed secrets. |
| `DISABLE_IN_PROCESS_WORKER` | no | Disable local in-process worker. |

---

## Database schema

Tables: `projects`, `tokens`, `trading_pairs`, `social_links`, `community_links`, `prospects`, `outreach_history`, `message_templates`, `discovery_jobs`, `api_sources`, `user_settings`, `notifications`, `worker_locks`, `provider_secrets`.

Key constraints:
- unique token/project identity: `(chain, contract_address_key)`
- unique pair identity: `(chain, pair_address_key)`
- unique community link per project/platform/normalized URL
- one prospect per project
- indexes for chain, discovery time, score, liquidity, volume, review status, community flags, full-text name/symbol search.

EVM addresses are normalized to lowercase. Solana addresses are preserved as returned by providers.

---

## API routes (server-side)

All except `/api/health` require auth in Supabase mode.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | DB/mode/config health; starts local worker in PGlite mode |
| GET | `/api/stats` | Dashboard overview counts |
| GET | `/api/projects` | Filter/search/sort/paginate projects |
| GET/PATCH | `/api/projects/[id]` | Project detail / review status |
| POST | `/api/projects/[id]/review` | Mark review status |
| POST | `/api/projects/[id]/prospect` | Save prospect |
| POST | `/api/projects/[id]/outreach` | Record human-reviewed outreach (duplicate protection) |
| POST | `/api/projects/[id]/verify-community` | Re-validate community links |
| GET/POST | `/api/prospects` | List/save prospects |
| PATCH/DELETE | `/api/prospects/[id]` | Update/delete prospect |
| GET/POST | `/api/templates` | Message templates |
| PATCH/DELETE | `/api/templates/[id]` | Edit/delete template |
| POST | `/api/messages/generate` | Generate editable personalized draft |
| GET/PUT | `/api/settings` | Settings, secret status, sources |
| GET/POST | `/api/notifications` | List/mark read |
| GET | `/api/jobs` | Discovery job history |
| POST | `/api/discovery/run` | Queue manual discovery job |
| GET/PATCH | `/api/sources` | Provider health/enablement |

---

## Testing

```bash
npm test             # unit/schema/provider/verification/outreach/settings/filter tests
npm run test:live    # opt-in live DEX Screener + GeckoTerminal smoke tests
npm run typecheck
npm run build
```

Test fixtures in `docs/research/` are saved live API responses used only for tests/documentation, not production seed data.

Manual integration smoke (local):
- discovery job creates real projects,
- project detail/community/provenance loads,
- template generation works,
- prospect save/update/delete works,
- outreach recording works,
- duplicate-contact protection returns 409.

---

## Deployment

See `docs/DEPLOYMENT.md`.

Recommended production topology:
- **Web**: Vercel / Node host / Docker (`npm run start`).
- **Worker**: always-on Node host / Docker (`npm run worker`) — Vercel serverless is not suitable for the long-running scheduler.
- **DB/Auth**: Supabase.
- **Providers**: DEX Screener keyless; GeckoTerminal paid key recommended for production; optional Telegram bot token.

---

## Important limitations & honesty notes

- DEX Screener has no universal “all new tokens” firehose. The app combines profile feeds with GeckoTerminal new pools and enrichment.
- GeckoTerminal keyless rate limits are low/dynamic and not recommended for production/commercial workloads. Use a paid CoinGecko onchain key for reliable production throughput.
- `pairCreatedAt` / `pool_created_at` are pair/pool creation times, not guaranteed token contract creation times.
- Telegram public-page hints are not cryptographic or bot verification. The UI distinguishes hints from verified groups.
- Discord invite validation confirms an accessible server invitation; it does not join or inspect private channels.
- Qualification score is a prospecting heuristic, not financial advice or proof a team needs services.
- Attribution: keyless CoinGecko/GeckoTerminal data requires attribution; the UI links to DEX Screener and GeckoTerminal/CoinGecko.

---

## Outreach safety rules enforced by design

- No automated unsolicited bulk direct messaging.
- No automatic joining of Telegram groups or Discord servers.
- No bypassing platform anti-spam protections.
- Drafts are editable and human-approved.
- Duplicate-contact protection discourages repeated approaches.
- Outreach history records platform, message, timestamp, status, and response notes.
