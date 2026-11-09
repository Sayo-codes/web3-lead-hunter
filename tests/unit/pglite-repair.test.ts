import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

describe('PGlite data-dir repair', () => {
  it('recreates empty runtime directories dropped by snapshots and clears stale pid', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wlh-pglite-'));
    const db = new PGlite(dir);
    await db.waitReady;
    await db.exec('CREATE TABLE repair_test (id int)');
    await db.close();

    // Simulate snapshot dropping empty dirs + killed process leaving pid file.
    await fs.rm(path.join(dir, 'pg_notify'), { recursive: true, force: true });
    await fs.rm(path.join(dir, 'pg_stat_tmp'), { recursive: true, force: true });
    await fs.writeFile(path.join(dir, 'postmaster.pid'), '-42\n/tmp/pglite/base\n');

    const { getDb } = await import('@/lib/db');
    process.env.PGLITE_DATA_DIR = dir;
    const repaired = await getDb();
    const rows = await repaired.query<{ id: number }>('SELECT 1 AS id');
    expect(rows[0].id).toBe(1);
    await expect(fs.stat(path.join(dir, 'pg_notify'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dir, 'postmaster.pid'))).resolves.toBeTruthy(); // PGlite recreates its own pid while open
    await repaired.close();
    delete process.env.PGLITE_DATA_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  }, 30000);
});
