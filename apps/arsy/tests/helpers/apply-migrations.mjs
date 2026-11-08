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
