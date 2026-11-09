import { describe, expect, it } from 'vitest';

const live = process.env.RUN_LIVE_API_TESTS === 'true';

describe.skipIf(!live)('live provider smoke tests (opt-in)', () => {
  it('DEX Screener latest token profiles responds', async () => {
    const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('GeckoTerminal new pools responds', async () => {
    const res = await fetch('https://api.geckoterminal.com/api/v2/networks/new_pools?include=base_token,quote_token&page=1', { headers: { Accept: 'application/json;version=20230203' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
