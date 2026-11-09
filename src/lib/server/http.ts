import { sleep } from '@/lib/utils';

export class HttpError extends Error {
  status: number;
  url: string;
  body?: string;
  constructor(message: string, status: number, url: string, body?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

class RateLimiter {
  private nextAt = 0;
  private queue: Promise<void> = Promise.resolve();
  constructor(private intervalMs: number) {}
  setInterval(perMinute: number) {
    this.intervalMs = Math.max(50, 60000 / Math.max(1, perMinute));
  }
  acquire(): Promise<void> {
    const run = this.queue.then(async () => {
      const wait = Math.max(0, this.nextAt - Date.now());
      if (wait > 0) await sleep(wait);
      this.nextAt = Date.now() + this.intervalMs;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

interface CacheEntry {
  expires: number;
  value: unknown;
}

const globalStore = globalThis as unknown as {
  __wlhLimiters?: Map<string, RateLimiter>;
  __wlhCache?: Map<string, CacheEntry>;
  __wlhInflight?: Map<string, Promise<unknown>>;
  __wlhHttpStats?: Record<string, { requests: number; errors: number; cacheHits: number }>;
};

function limiters() {
  if (!globalStore.__wlhLimiters) globalStore.__wlhLimiters = new Map();
  return globalStore.__wlhLimiters;
}
function cache() {
  if (!globalStore.__wlhCache) globalStore.__wlhCache = new Map();
  return globalStore.__wlhCache;
}
function inflight() {
  if (!globalStore.__wlhInflight) globalStore.__wlhInflight = new Map();
  return globalStore.__wlhInflight;
}
export function httpStats() {
  if (!globalStore.__wlhHttpStats) globalStore.__wlhHttpStats = {};
  return globalStore.__wlhHttpStats;
}
function stat(provider: string, key: 'requests' | 'errors' | 'cacheHits') {
  const s = httpStats();
  if (!s[provider]) s[provider] = { requests: 0, errors: 0, cacheHits: 0 };
  s[provider][key]++;
}

export function getLimiter(provider: string, perMinute: number): RateLimiter {
  const map = limiters();
  let l = map.get(provider);
  if (!l) {
    l = new RateLimiter(60000 / Math.max(1, perMinute));
    map.set(provider, l);
  } else {
    l.setInterval(perMinute);
  }
  return l;
}

interface FetchOptions {
  provider: string;
  rateLimitPerMin?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  method?: 'GET';
}

async function rawFetch(url: string, opts: FetchOptions, accept: string): Promise<{ text: string; status: number; headers: Headers }> {
  const limiter = getLimiter(opts.provider, opts.rateLimitPerMin ?? 30);
  const retries = opts.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await limiter.acquire();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
    try {
      stat(opts.provider, 'requests');
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: { Accept: accept, 'User-Agent': 'Web3LeadHunter/1.0 (+https://github.com/web3-lead-hunter)', ...opts.headers },
        signal: controller.signal,
        cache: 'no-store',
      });
      const text = await res.text();
      if (res.ok) return { text, status: res.status, headers: res.headers };
      const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
      if (retryable && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * 2 ** attempt + Math.random() * 500);
        await sleep(backoff);
        lastError = new HttpError(`HTTP ${res.status}`, res.status, url, text.slice(0, 500));
        continue;
      }
      stat(opts.provider, 'errors');
      throw new HttpError(`HTTP ${res.status}`, res.status, url, text.slice(0, 500));
    } catch (err) {
      stat(opts.provider, 'errors');
      lastError = err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isHttp = err instanceof HttpError;
      const retryable = isAbort || (isHttp && (err.status === 429 || err.status === 408 || err.status >= 500));
      if (retryable && attempt < retries) {
        await sleep(Math.min(30000, 1000 * 2 ** attempt + Math.random() * 500));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<T> {
  const ttl = opts.cacheTtlMs ?? 0;
  const key = `${opts.provider}:${url}`;
  if (ttl > 0) {
    const hit = cache().get(key);
    if (hit && hit.expires > Date.now()) {
      stat(opts.provider, 'cacheHits');
      return hit.value as T;
    }
  }
  const existing = inflight().get(key);
  if (existing) return existing as Promise<T>;
  const promise = (async () => {
    const { text } = await rawFetch(url, opts, 'application/json');
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      throw new HttpError('Invalid JSON response', 502, url, text.slice(0, 300));
    }
    if (ttl > 0) cache().set(key, { expires: Date.now() + ttl, value: parsed });
    return parsed;
  })();
  inflight().set(key, promise);
  try {
    return await promise;
  } finally {
    inflight().delete(key);
  }
}

export async function fetchText(url: string, opts: FetchOptions): Promise<string> {
  const ttl = opts.cacheTtlMs ?? 0;
  const key = `${opts.provider}:text:${url}`;
  if (ttl > 0) {
    const hit = cache().get(key);
    if (hit && hit.expires > Date.now()) {
      stat(opts.provider, 'cacheHits');
      return hit.value as string;
    }
  }
  const { text } = await rawFetch(url, opts, 'text/html,application/xhtml+xml,application/json');
  if (ttl > 0) cache().set(key, { expires: Date.now() + ttl, value: text });
  return text;
}
