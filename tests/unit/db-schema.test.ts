import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('database schema', () => {
  it('applies migrations and enforces token/project dedupe by chain + address', async () => {
    const db = new PGlite();
    await db.waitReady;
    const dir = path.join(process.cwd(), 'supabase/migrations');
    await db.exec(await fs.readFile(path.join(dir, '202611080001_core.sql'), 'utf8'));
    await db.exec(await fs.readFile(path.join(dir, '202611080002_seed.sql'), 'utf8'));
    const insertToken = `INSERT INTO tokens (chain, contract_address, contract_address_key, name, symbol) VALUES ('ethereum','0xAbC','0xabc','Test','TST') ON CONFLICT (chain, contract_address_key) DO UPDATE SET name=EXCLUDED.name RETURNING id`;
    const t1 = await db.query<{ id: string }>(insertToken);
    const t2 = await db.query<{ id: string }>(insertToken);
    expect(t1.rows[0].id).toBe(t2.rows[0].id);
    await db.query(`INSERT INTO projects (token_id, chain, contract_address, contract_address_key, name, symbol) VALUES ($1,'ethereum','0xAbC','0xabc','Test','TST') ON CONFLICT (chain, contract_address_key) DO NOTHING`, [t1.rows[0].id]);
    await db.query(`INSERT INTO projects (token_id, chain, contract_address, contract_address_key, name, symbol) VALUES ($1,'ethereum','0xAbC','0xabc','Test','TST') ON CONFLICT (chain, contract_address_key) DO NOTHING`, [t1.rows[0].id]);
    const count = await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM projects WHERE chain='ethereum' AND contract_address_key='0xabc'`);
    expect(count.rows[0].count).toBe(1);
    const settings = await db.query<{ id: string }>(`SELECT id FROM user_settings WHERE id='default'`);
    expect(settings.rows).toHaveLength(1);
    const templates = await db.query<{ id: string }>(`SELECT id FROM message_templates`);
    expect(templates.rows.length).toBeGreaterThanOrEqual(3);
    await db.close();
  });
});
