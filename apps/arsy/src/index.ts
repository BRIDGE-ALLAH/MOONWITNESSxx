import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createApp } from './app.ts'
import { resolveServerConfig } from './config.ts'

export { createApp }

export function getListenConfig(env: NodeJS.ProcessEnv = process.env): { host: string; port: number } {
  return resolveServerConfig(env)
}

export async function startServer() {
  const app = createApp()

  try {
    await app.listen(getListenConfig())
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }

  const shutdown = async () => {
    try {
      await app.close()
    } catch (error) {
      console.error('ARSY graceful shutdown failed:', error)
      process.exitCode = 1
    }
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startServer().catch((error: unknown) => {
    console.error('ARSY startup failed:', error)
    process.exitCode = 1
  })
}
