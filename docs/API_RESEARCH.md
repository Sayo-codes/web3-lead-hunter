# API Research — Web3 Lead Hunter

Inspected: 2026-11-08. Live samples are saved in `docs/research/` and are used only as test fixtures, never as production seed data.

## 1. DEX Screener

Official reference: https://docs.dexscreener.com/api/reference

### Endpoints used

| Purpose | Endpoint | Rate limit | Notes |
|---|---|---:|---|
| Discover recently submitted token profiles | `GET https://api.dexscreener.com/token-profiles/latest/v1` | 60/min | Returns up to ~30 profiles. No pagination. Not a universal new-token firehose; profiles may be for older tokens. |
| Refresh changed profile metadata | `GET https://api.dexscreener.com/token-profiles/recent-updates/v1` | 60/min | Same shape as latest profiles. Used for incremental metadata refresh. |
| Enrich tokens with pair/market data | `GET https://api.dexscreener.com/tokens/v1/{chainId}/{tokenAddresses}` | 300/min | Comma-separated token addresses, up to 30 per call. Returns pairs for those tokens. |
| Pair lookup (optional/manual) | `GET https://api.dexscreener.com/latest/dex/pairs/{chainId}/{pairId}` | 300/min | Not used for bulk discovery. |

### Fields actually available

From `/tokens/v1/...` pair objects:

- `chainId`, `dexId`, `url`, `pairAddress`, `labels`
- `baseToken.address/name/symbol`, `quoteToken.address/name/symbol`
- `priceUsd`, `priceNative`
- `txns.{m5,h1,h6,h24}.{buys,sells}`
- `volume.{m5,h1,h6,h24}`
- `liquidity.{usd,base,quote}`
- `fdv`, `marketCap`
- `pairCreatedAt` (Unix milliseconds, nullable)
- `info.websites[]`, `info.socials[]` (`platform`/`type`, `url`/`handle`), `info.imageUrl`

From token profile objects:

- `chainId`, `tokenAddress`, `url`, `icon`, `header`, `description`
- `links[]` with `type`/`label` and `url` (website, docs, twitter, telegram, discord, github, etc.)

### Limitations

- No official universal “all new pairs” endpoint. Discovery uses profile feeds plus GeckoTerminal new pools, then enriches via token pair lookup.
- `pairCreatedAt` is pair creation, not guaranteed token contract creation. The app labels it as earliest known pair creation.
- Social links are provider metadata. They are not proof of an accessible group/server until validated.
- Keyless public API. Respect rate limits and cache. No API key is required for the endpoints used.

## 2. GeckoTerminal

Official docs: https://www.geckoterminal.com/dex-api  
Swagger: https://api.geckoterminal.com/docs/v2/swagger.json  
Keyless policy: https://docs.coingecko.com/docs/keyless-public-api

Base URL: `https://api.geckoterminal.com/api/v2`  
Recommended header: `Accept: application/json;version=20230203`

### Endpoints used

| Purpose | Endpoint | Notes |
|---|---|---|
| Discover newly created pools across networks | `GET /networks/new_pools?include=base_token,quote_token&page={1..10}` | 20 pools/page, max page 10. Primary new-pool discovery source. |
| Discover new pools per network (optional paid/high-rate mode) | `GET /networks/{network}/new_pools?include=base_token,quote_token&page={1..10}` | Same shape. Disabled by default on keyless to respect rate limits. |
| Recently updated token metadata | `GET /tokens/info_recently_updated` | Up to 100 tokens. Includes social handles and description when available. |
| Token info (manual/enrichment) | `GET /networks/{network}/tokens/{address}/info` | Detailed token metadata. Used sparingly. |
| Networks ID map | `GET /networks` | Confirmed IDs: `eth`, `base`, `solana`, `bsc`, `arbitrum`, `optimism`, `polygon_pos`, `avax`. |

### Fields actually available

Pool attributes:

- `address`, `name`, `pool_created_at`
- `base_token_price_usd`, `fdv_usd`, `market_cap_usd`
- `volume_usd.{m5,m15,m30,h1,h6,h24}`
- `transactions.{...}.{buys,sells,buyers,sellers}`
- `reserve_in_usd` (nullable)
- relationships: `base_token`, `quote_token`, `network`, `dex`
- included token attributes: `address`, `name`, `symbol`, `decimals`, `image_url`, `coingecko_coin_id`

Token info attributes:

- `name`, `symbol`, `decimals`, `image_url`, `coingecko_coin_id`
- `websites[]`, `discord_url`, `telegram_handle`, `twitter_handle`, `description`
- `gt_score`, `metadata_updated_at`

### Limitations

- Keyless GeckoTerminal is currently documented as dynamic and low-throughput (~5/min in the keyless guide; the DEX API page says ~10/min and may fluctuate). The app defaults to a conservative 5/min limiter, 1 global new-pools page per run, and a 3-minute schedule.
- Keyless endpoints are not recommended for production/commercial workloads. For production, configure a CoinGecko paid onchain key or run with reduced frequency and accept provider variability.
- Attribution is required when displaying keyless CoinGecko/GeckoTerminal data. The UI includes attribution.
- `pool_created_at` is pool creation, not guaranteed token creation.
- `telegram_handle` is a handle, not a verified group. It is normalized to `https://t.me/{handle}` and then classified/validated separately.

## 3. Community verification

### Discord

Official Discord API: `GET https://discord.com/api/v10/invites/{code}?with_counts=true&with_expiration=true`

- Recognizes `discord.gg/CODE` and `discord.com/invite/CODE`.
- A successful invite response with a `guild` object is stored as `community_type=server`, `validation_status=verified`, `verification_method=discord_invite_api`.
- 404/unknown invite -> `invalid`. 401/403 or restricted responses -> `restricted`/`unknown`, not bypassed.
- The app never joins servers and never uses user tokens.

### Telegram

There is no official public HTTP API that resolves an arbitrary `t.me` username into group/channel without bot access.

The app uses a layered, non-bypassing approach:

1. URL pattern classification:
   - `t.me/+CODE`, `telegram.me/joinchat/CODE`, `t.me/joinchat/CODE` -> `private_invite`, unknown group/channel until verified.
   - public `t.me/name` -> unknown until checked.
2. Optional Telegram Bot API `getChat` when `TELEGRAM_BOT_TOKEN` is configured and the bot already has access to the chat. This can verify `group`, `supergroup`, or `channel`. The bot never auto-joins.
3. Optional public `t.me` page check (enabled by default, rate-limited, no login, no joining). The public preview often exposes `tgme_page_extra` such as `123 members` or `123 subscribers`.
   - `members` -> group hint, `validation_status=accessible`, `is_verified=false`, method `telegram_public_page`.
   - `subscribers` -> channel hint, `validation_status=accessible`, `is_verified=false`.
   - If the page cannot be fetched or parsed, status remains `unknown`/`unverified`.

The UI never labels a Telegram group as “verified” unless Bot API verification succeeded. Public-page hints are labeled as hints.

## 4. Data provenance model

Every stored fact is tagged:

- `api`: returned directly by DEX Screener / GeckoTerminal / Discord / Telegram Bot API.
- `metadata_extracted`: parsed from provider metadata, descriptions, or handles.
- `verified`: confirmed by a permitted check (Discord invite API, Telegram Bot API).
- `public_hint`: accessible public page hint, not a verified group.
- `unknown`: unavailable or not yet checked.

Unavailable fields are stored as `NULL` and rendered as “Unavailable”, never fabricated.
