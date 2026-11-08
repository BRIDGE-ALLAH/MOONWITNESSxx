/**
 * Serialize DDL setup across ARSY integration test files that share TEST_DATABASE_URL.
 *
 * PostgreSQL CREATE TABLE IF NOT EXISTS is not a cross-session migration mutex:
 * concurrent creation can race while PostgreSQL registers the table's composite
 * row type. Keep the advisory lock and all migration statements on one session.
 */
export async function applyTestMigrations(pool, migrations) {
  const client = await pool.connect()
  let locked = false
  try {
    await client.query('SELECT pg_advisory_lock(20261108, 6)')
    locked = true
    // The CI integration workflow runs the checksum-verified full migration runner first.
    // Avoid replaying legacy bootstrap SQL over the newer owner-scoped schema.
    const schemaVersion = await client.query(
      `SELECT COUNT(*)::int AS applied
       FROM arsy_schema_migrations
       WHERE name = ANY($1::text[])`,
      [[
        '002_money_maker_core.sql',
        '005_money_maker_assets.sql',
        '006_money_maker_channels_and_listings.sql',
        '007_payout_lifecycle_and_fx.sql',
      ]],
    ).catch(() => ({ rows: [{ applied: 0 }] }))
    if (schemaVersion.rows[0]?.applied === 4) return
    for (const migration of migrations) {
      await client.query(migration)
    }
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(20261108, 6)')
    } finally {
      client.release()
    }
  }
}
