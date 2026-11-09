async function main() {
  await import('tsconfig-paths/register');
  const { getDb, runMigrations } = await import('../src/lib/db');
  const db = await getDb();
  await runMigrations(db, db.mode === 'supabase');
  console.log(`Migrations applied (${db.mode}).`);
  await db.close();
}
main().catch((err) => { console.error(err); process.exit(1); });

export {};
