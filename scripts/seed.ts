async function main() {
  await import('tsconfig-paths/register');
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { getDb } = await import('../src/lib/db');
  const db = await getDb();
  await db.exec(await fs.readFile(path.join(process.cwd(), 'supabase/migrations/202611080002_seed.sql'), 'utf8'));
  console.log('Configuration seed applied (no project data).');
  await db.close();
}
main().catch((err) => { console.error(err); process.exit(1); });

export {};
