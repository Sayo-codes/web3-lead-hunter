import fs from 'node:fs/promises';
import path from 'node:path';
import { getDbMode } from '@/lib/config';

export interface Db {
  mode: 'pglite' | 'supabase';
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
}

const CORE_MIGRATIONS = ['202611080001_core.sql', '202611080002_seed.sql'];
const ALL_MIGRATIONS = [...CORE_MIGRATIONS, '202611080003_rls.sql'];

async function readMigration(file: string) {
  return fs.readFile(path.join(process.cwd(), 'supabase', 'migrations', file), 'utf8');
}

export async function runMigrations(db: Db, includeSupabaseHardening = db.mode === 'supabase') {
  const files = includeSupabaseHardening ? ALL_MIGRATIONS : CORE_MIGRATIONS;
  for (const file of files) {
    await db.exec(await readMigration(file));
  }
}

class PgDb implements Db {
  mode = 'supabase' as const;
  constructor(private pool: import('pg').Pool) {}
  async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(text, params);
    return res.rows as T[];
  }
  async exec(text: string) {
    await this.pool.query(text);
  }
  async close() {
    await this.pool.end();
  }
}

class PgliteDb implements Db {
  mode = 'pglite' as const;
  constructor(private db: import('@electric-sql/pglite').PGlite) {}
  async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.db.query<T>(text, params);
    return res.rows;
  }
  async exec(text: string) {
    await this.db.exec(text);
  }
  async close() {
    await this.db.close();
  }
}

const PGLITE_REQUIRED_DIRS = [
  'base', 'global', 'pg_commit_ts', 'pg_dynshmem', 'pg_logical', 'pg_logical/mappings',
  'pg_logical/snapshots', 'pg_multixact', 'pg_multixact/members', 'pg_multixact/offsets',
  'pg_notify', 'pg_replslot', 'pg_serial', 'pg_snapshots', 'pg_stat', 'pg_stat_tmp',
  'pg_subtrans', 'pg_tblspc', 'pg_twophase', 'pg_wal', 'pg_wal/archive_status',
  'pg_wal/summaries', 'pg_xact',
];

/**
 * Workspace snapshots can drop empty directories. PGlite/Postgres requires these
 * runtime dirs to exist; recreate missing ones before opening an existing data dir.
 * Also remove stale postmaster.pid left by a killed process (PGlite is single-process).
 */
async function repairPgliteDataDir(dataDir: string) {
  const versionFile = path.join(dataDir, 'PG_VERSION');
  const exists = await fs.stat(versionFile).then(() => true).catch(() => false);
  if (!exists) return;
  await Promise.all(PGLITE_REQUIRED_DIRS.map((dir) => fs.mkdir(path.join(dataDir, dir), { recursive: true })));
  await fs.rm(path.join(dataDir, 'postmaster.pid'), { force: true });
}

const globalDb = globalThis as unknown as { __wlhDbPromise?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalDb.__wlhDbPromise) {
    globalDb.__wlhDbPromise = createDb().catch((err) => {
      globalDb.__wlhDbPromise = undefined;
      throw err;
    });
  }
  return globalDb.__wlhDbPromise;
}

async function createDb(): Promise<Db> {
  const mode = getDbMode();
  if (mode === 'supabase') {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error('SUPABASE_DB_URL is required when DB_MODE=supabase');
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX || 5),
      ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    });
    const db = new PgDb(pool);
    // Production migrations are explicit (`npm run db:migrate`). Verify connectivity only.
    await db.query('SELECT 1');
    return db;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || '.data/pglite');
  await fs.mkdir(dataDir, { recursive: true });
  await repairPgliteDataDir(dataDir);
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;
  const db = new PgliteDb(pglite);
  await runMigrations(db, false);
  return db;
}

export async function q<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}
