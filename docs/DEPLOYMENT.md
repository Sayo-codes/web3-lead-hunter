# Deployment Guide

## Topology

Production uses three pieces:

1. **Supabase** — PostgreSQL + Auth.
2. **Web app** — Next.js (`npm run start`). Can be Vercel, Render, Railway, Fly.io, Docker, or a VPS.
3. **Worker** — always-on Node process (`npm run worker`). Must not be a short-lived serverless function.

The web app queues manual discovery jobs; the worker processes queued jobs and creates scheduled jobs. A DB-backed lock prevents overlapping runs.

---

## Option A: Vercel web + Railway/Render worker + Supabase

### Supabase
- Create project, enable Email auth, create owner user.
- Copy Project URL, anon key, and Postgres connection string.
- Run migrations from your machine:

```bash
SUPABASE_DB_URL='postgresql://...' npm run db:migrate
```

### Vercel (web)
- Import repo.
- Environment variables:
  - `DB_MODE=supabase`
  - `SUPABASE_DB_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `OWNER_EMAIL`
  - optional `GECKO_USE_PAID`, `COINGECKO_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SECRETS_ENCRYPTION_KEY`
- Build command: `npm run build`
- Output: Next.js default.
- Do **not** rely on Vercel for the worker.

### Railway / Render / Fly.io (worker)
- Same repo.
- Start command: `npm run worker`
- Same server-side env vars (at least `SUPABASE_DB_URL`, provider keys).
- Keep the service always-on. Restart policy: always.
- The worker logs job completion and recovers stale running jobs on startup.

---

## Option B: Docker Compose (web + worker) + Supabase

Create `.env` from `.env.example` and set Supabase values.

```bash
docker compose up --build -d
```

Services:
- `web`: Next.js on port 3000
- `worker`: dedicated ingestion worker

Both use `DB_MODE=supabase`. PGlite is not used in this production compose file.

---

## Option C: Single VPS with PM2

```bash
npm ci
npm run build
npm run db:migrate
pm2 start npm --name wlh-web -- run start
pm2 start npm --name wlh-worker -- run worker
pm2 save
```

Use Nginx/Caddy to TLS-terminate port 3000. Keep the worker process alive.

---

## Health checks & monitoring

- Web health: `GET /api/health`
- Worker: process logs (`[worker] completed discovery job ...`)
- Dashboard: `/system` shows job history, provider health, errors, logs.
- Failed jobs are stored in `discovery_jobs`; stale running jobs are recovered on worker startup.
- Provider failures do not stop other providers. Jobs can complete with errors.

---

## Production checklist

- [ ] Supabase migrations applied.
- [ ] RLS migration applied; direct anon/authenticated table access denied.
- [ ] `OWNER_EMAIL` set to your account.
- [ ] `SUPABASE_DB_URL` kept server-side only.
- [ ] Dedicated worker running and restarted on failure.
- [ ] GeckoTerminal paid key configured if you need reliable production throughput.
- [ ] Discovery interval and rate limits tuned to your provider plan.
- [ ] Community verification settings reviewed (Telegram public hints vs bot verification).
- [ ] Outreach duplicate-contact window configured.
- [ ] Attribution links visible (DEX Screener, GeckoTerminal/CoinGecko).
- [ ] Backups enabled in Supabase.

---

## Scaling notes

- Projects table is indexed for common filters/sorts and full-text name/symbol search.
- Discovery is incremental: new feeds + bounded stale refresh, not full historical rescans.
- GeckoTerminal requests are budgeted per run; global discovery includes one rotating enabled chain per run. Use `gecko_per_chain` for explicit multi-chain sweeps and a paid key for higher throughput.
- Local PGlite startup repairs missing empty runtime directories and stale `postmaster.pid` files left by killed processes/snapshots. Do not point two processes at the same PGlite data dir; use Supabase + dedicated worker for multi-process production.
- Community checks are TTL-cached (default 6h).
- DEX enrichment batches up to 30 addresses per request.
- For very large datasets, increase worker host resources, use Supabase connection pooling, and consider partitioning `trading_pairs` / `outreach_history` by time.
- Add providers by implementing `DiscoveryProvider` and registering in `src/lib/providers/index.ts`.
