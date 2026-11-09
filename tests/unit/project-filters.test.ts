import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let dir: string;
let listProjects: (typeof import('@/lib/db/repository'))['listProjects'];
let getDb: (typeof import('@/lib/db'))['getDb'];

async function seedProject(key: string, name: string) {
  const db = await getDb();
  const token = await db.query<{ id: string }>(
    `INSERT INTO tokens (chain, contract_address, contract_address_key, name, symbol) VALUES ('base',$1,$1,$2,'T') RETURNING id`,
    [key, name],
  );
  const project = await db.query<{ id: string }>(
    `INSERT INTO projects (token_id, chain, contract_address, contract_address_key, name, symbol) VALUES ($1,'base',$2,$2,$3,'T') RETURNING id`,
    [token[0].id, key, name],
  );
  return project[0].id;
}

async function addCommunity(projectId: string, platform: 'telegram' | 'discord', type: string, status: string, url: string) {
  const db = await getDb();
  await db.query(
    `INSERT INTO community_links (project_id, platform, url, normalized_url, community_type, validation_status) VALUES ($1,$2,$3,$3,$4,$5)`,
    [projectId, platform, url, type, status],
  );
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wlh-filters-'));
  process.env.PGLITE_DATA_DIR = dir;
  process.env.DB_MODE = 'pglite';
  const g = globalThis as unknown as { __wlhDbPromise?: unknown };
  delete g.__wlhDbPromise;
  ({ getDb } = await import('@/lib/db'));
  ({ listProjects } = await import('@/lib/db/repository'));

  const tgAccessible = await seedProject('0xaaa', 'TG Accessible');
  await addCommunity(tgAccessible, 'telegram', 'group', 'accessible', 'https://t.me/tgaccessible');

  const tgInvite = await seedProject('0xbbb', 'TG Private Invite');
  await addCommunity(tgInvite, 'telegram', 'private_invite', 'unknown', 'https://t.me/+secret');

  const discordVerified = await seedProject('0xccc', 'Discord Verified');
  await addCommunity(discordVerified, 'discord', 'server', 'verified', 'https://discord.gg/abc');

  const both = await seedProject('0xddd', 'Both Communities');
  await addCommunity(both, 'telegram', 'group', 'verified', 'https://t.me/bothgroup');
  await addCommunity(both, 'discord', 'server', 'accessible', 'https://discord.gg/both');

  const tgUnknown = await seedProject('0xeee', 'TG Unknown Group');
  await addCommunity(tgUnknown, 'telegram', 'group', 'unknown', 'https://t.me/unknowngroup');
}, 30000);

afterAll(async () => {
  const g = globalThis as unknown as { __wlhDbPromise?: Promise<{ close(): Promise<void> }> };
  if (g.__wlhDbPromise) await (await g.__wlhDbPromise).close();
  delete g.__wlhDbPromise;
  delete process.env.PGLITE_DATA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe('project community filters', () => {
  it('defaults to accessible Telegram groups or Discord servers', async () => {
    const res = await listProjects({ community: 'either', page: 1, pageSize: 50 });
    expect(res.total).toBe(3);
    expect(res.rows.map((r) => r.name).sort()).toEqual(['Both Communities', 'Discord Verified', 'TG Accessible']);
  });

  it('includes private Telegram invites only when explicitly allowed', async () => {
    const strict = await listProjects({ community: 'telegram_group', page: 1, pageSize: 50 });
    expect(strict.total).toBe(2);
    const relaxed = await listProjects({ community: 'telegram_group', includeUnverifiedInvites: true, page: 1, pageSize: 50 });
    expect(relaxed.total).toBe(3);
    expect(relaxed.rows.some((r) => r.name === 'TG Private Invite')).toBe(true);
  });

  it('honors requireAccessible=false for unknown/unverified community links', async () => {
    const strict = await listProjects({ community: 'telegram_group', page: 1, pageSize: 50 });
    expect(strict.rows.some((r) => r.name === 'TG Unknown Group')).toBe(false);
    const relaxed = await listProjects({ community: 'telegram_group', requireAccessible: false, page: 1, pageSize: 50 });
    expect(relaxed.total).toBe(3);
    expect(relaxed.rows.some((r) => r.name === 'TG Unknown Group')).toBe(true);
  });

  it('requires both communities when community=both', async () => {
    const res = await listProjects({ community: 'both', page: 1, pageSize: 50 });
    expect(res.total).toBe(1);
    expect(res.rows[0].name).toBe('Both Communities');
  });
});
