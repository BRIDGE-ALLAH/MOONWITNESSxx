import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const directory = path.dirname(fileURLToPath(import.meta.url))
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required to run migrations')

  await pool.query(`CREATE TABLE IF NOT EXISTS arsy_schema_migrations (
    name text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)

  const files = (await readdir(path.resolve(directory, '../../migrations')))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
    .sort()

  for (const name of files) {
    const sql = await readFile(path.resolve(directory, '../../migrations', name), 'utf8')
    const checksum = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(sql).digest('hex'))
    const existing = await pool.query<{ checksum: string }>(
      'SELECT checksum FROM arsy_schema_migrations WHERE name = $1',
      [name],
    )
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration ${name} has changed. Add a new migration instead of editing history.`)
      }
      continue
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO arsy_schema_migrations (name, checksum) VALUES ($1, $2)',
        [name, checksum],
      )
      await client.query('COMMIT')
      process.stdout.write(`APPLIED ${name}\n`)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
}

run()
  .catch((error: unknown) => {
    process.stderr.write(`Migration failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
