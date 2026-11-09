export type DbMode = 'pglite' | 'supabase';

export function getDbMode(): DbMode {
  if (process.env.SUPABASE_DB_URL) return 'supabase';
  return process.env.DB_MODE === 'supabase' ? 'supabase' : 'pglite';
}

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getServerConfig() {
  return {
    dbMode: getDbMode(),
    supabaseAuth: isSupabaseAuthEnabled(),
    ownerEmail: process.env.OWNER_EMAIL || null,
    workerPollSeconds: Number(process.env.WORKER_POLL_SECONDS || 15),
    discoveryIntervalMinutes: Number(process.env.DISCOVERY_INTERVAL_MINUTES || 3),
    geckoRateLimitPerMin: Number(process.env.GECKO_RATE_LIMIT_PER_MIN || 5),
    dexRateLimitPerMin: Number(process.env.DEXSCREENER_RATE_LIMIT_PER_MIN || 50),
    geckoUsePaid: process.env.GECKO_USE_PAID === 'true',
    telegramPublicPageChecks: process.env.TELEGRAM_PUBLIC_PAGE_CHECKS !== 'false',
    discordInviteChecks: process.env.DISCORD_INVITE_CHECKS !== 'false',
    secretsStorageEnabled: Boolean(process.env.SECRETS_ENCRYPTION_KEY),
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Web3 Lead Hunter',
  };
}

export function publicConfig() {
  const c = getServerConfig();
  return {
    dbMode: c.dbMode,
    supabaseAuth: c.supabaseAuth,
    appName: c.appName,
    secretsStorageEnabled: c.secretsStorageEnabled,
    geckoUsePaid: c.geckoUsePaid,
    telegramPublicPageChecks: c.telegramPublicPageChecks,
    discordInviteChecks: c.discordInviteChecks,
  };
}
