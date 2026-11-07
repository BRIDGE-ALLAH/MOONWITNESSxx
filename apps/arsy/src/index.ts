import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApp } from './app.ts'
import { createDatabasePool } from './db.ts'
import { resolveServerConfig } from './config.ts'

export { createApp }

export async function startServer() {
  const app = createApp({ databasePool: createDatabasePool() })

  try {
    await app.listen(resolveServerConfig())
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }

  const shutdown = async () => {
    try {
      await app.close()
    } catch (error) {
      app.log.error({ err: error }, 'ARSY graceful shutdown failed')
      process.exitCode = 1
    }
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  return app
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  startServer().catch((error: unknown) => {
    console.error('ARSY startup failed:', error)
    process.exitCode = 1
  })
}
