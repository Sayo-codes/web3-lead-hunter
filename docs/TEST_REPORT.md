# Test Report — Hardening Pass

Date: 2026-11-08

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, no ESLint warnings/errors |
| `npm test` | 32 passed, 2 live tests skipped by default |
| `npm run test:live` | 2 passed (DEX Screener profiles, GeckoTerminal new pools) |
| `npm run build` | Passed (Next.js production build) |

## Unit / integration coverage

- Community URL extraction and normalization
  - public Telegram URLs
  - private invite formats (`+CODE`, `joinchat/CODE`)
  - Discord invite formats (`discord.gg`, `discord.com/invite`, `discordapp.com/invite`)
  - description URL extraction
- Community verification behavior
  - Discord invite API success -> verified server
  - Discord 404 -> invalid, no bypass
  - Telegram public page `members` -> accessible group hint, not verified
  - Telegram public page `subscribers` -> channel hint
  - Telegram private invite -> unknown, no auto-join
  - Telegram Bot API `supergroup` -> verified group
- Provider normalization using saved live fixtures
  - DEX Screener token pairs + socials
  - GeckoTerminal new pools
  - GeckoTerminal recently updated metadata
- GeckoTerminal scheduling
  - per-run request budget on short intervals
  - per-chain rotation instead of starving later chains
- Qualification engine
  - transparent score/reasons
  - high volume alone does not satisfy default community requirement
  - both/either/telegram/discord requirements
  - private invites not treated as accessible groups by default
- Database schema
  - migrations apply
  - token/project dedupe by chain + address key
  - settings/templates seeded without project data
- Project community filters
  - default accessible Telegram group OR Discord server
  - private Telegram invites included only when explicitly allowed
  - `requireAccessible=false` includes unknown/unverified links
  - `community=both` requires both platforms
- PGlite data-dir repair
  - recreates empty runtime directories dropped by workspace snapshots
  - clears stale `postmaster.pid` before reopening an existing data dir
- Outreach templates
  - variable interpolation
  - selected services override
- Settings/outreach validation
  - supported chains, interval bounds, score bounds
  - non-empty outreach message

## Standalone worker smoke

An isolated PGlite data directory was used to avoid touching the preview database.

Command shape:

```bash
PGLITE_DATA_DIR=.data/worker-test3 \
WORKER_POLL_SECONDS=5 \
TELEGRAM_PUBLIC_PAGE_CHECKS=false \
DISCORD_INVITE_CHECKS=false \
npm run worker
```

Result:
- standalone worker started via `tsx worker/index.ts`
- scheduled job created and completed
- 55 real projects created
- 92 social links found
- job status `completed`, no error

Community checks were disabled for this smoke test to keep it fast; verification behavior is covered by mocked unit tests and prior live API inspection.

## Manual API smoke (previous pass)

- discovery job created real projects
- project detail loaded
- template generation worked
- prospect save/update/delete worked
- outreach recording worked
- duplicate-contact protection returned 409
- settings/stats/sources APIs worked

## Production smoke after hardening

`npm run start` on port 3000:

- `/api/health` returned `status: ok`, `mode: pglite`
- dashboard returned HTTP 200
- in-process worker started and completed a scheduled discovery job
- stats after the job: 344 total projects, 78 new today, 8 Telegram groups, 1 Discord server, 1 project with both, 6 qualified
- `community=either` returned accessible-community projects only
- `community=both` returned the project with both Telegram group and Discord server
- `community=discord_server` returned the verified/accessible Discord project
- relaxed filters (`requireAccessible=false`, `includeUnverifiedInvites=true`) returned a larger candidate set
- Docker-style healthcheck command (`node -e fetch('/api/health')`) succeeded against the running server

## Recovery note

A sandbox restart dropped empty PGlite runtime directories and left a stale `postmaster.pid`, causing PGlite to abort on startup. The data directory was recovered without losing projects by recreating the required empty directories and removing the stale pid file. `src/lib/db/index.ts` now performs this repair automatically before opening an existing PGlite data dir, and a regression test covers it.

## Known limitations

- Keyless GeckoTerminal throughput is low/dynamic; production should use a paid CoinGecko onchain key or conservative intervals.
- Telegram public-page hints are not bot verification.
- Pair/pool creation time is not guaranteed token contract creation time.
- Discord validation confirms an accessible invitation, not private server contents.
