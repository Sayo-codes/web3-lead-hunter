import crypto from 'node:crypto';
import { one, q } from '@/lib/db';

const ENV_MAP: Record<string, string> = {
  coingecko: 'COINGECKO_API_KEY',
  telegram_bot: 'TELEGRAM_BOT_TOKEN',
};

function getKey(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch {
    return null;
  }
  return null;
}

export function secretsStorageEnabled() {
  return getKey() !== null;
}

export async function getProviderSecret(id: string): Promise<string | null> {
  const key = getKey();
  if (key) {
    const row = await one<{ encrypted_value: string; iv: string; auth_tag: string }>(
      'SELECT encrypted_value, iv, auth_tag FROM provider_secrets WHERE id = $1',
      [id],
    );
    if (row) {
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(row.encrypted_value, 'base64')), decipher.final()]);
        return decrypted.toString('utf8');
      } catch {
        // Fall through to env if stored secret cannot be decrypted.
      }
    }
  }
  const envName = ENV_MAP[id];
  return envName ? process.env[envName] || null : null;
}

export async function setProviderSecret(id: string, value: string): Promise<void> {
  const key = getKey();
  if (!key) throw new Error('SECRETS_ENCRYPTION_KEY is not configured; use server environment variables instead.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  await q(
    `INSERT INTO provider_secrets (id, encrypted_value, iv, auth_tag, updated_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (id) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag, updated_at = now()`,
    [id, encrypted.toString('base64'), iv.toString('base64'), tag.toString('base64')],
  );
}

export async function deleteProviderSecret(id: string): Promise<void> {
  await q('DELETE FROM provider_secrets WHERE id = $1', [id]);
}

export async function getSecretStatuses() {
  const rows = await q<{ id: string }>('SELECT id FROM provider_secrets');
  const stored = new Set(rows.map((r) => r.id));
  return Object.entries(ENV_MAP).map(([id, envName]) => ({
    id,
    envName,
    envConfigured: Boolean(process.env[envName]),
    storedConfigured: stored.has(id),
    configured: Boolean(process.env[envName]) || stored.has(id),
  }));
}
