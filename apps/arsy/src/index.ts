import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { createApp } from './app.ts'
import { resolveServerConfig } from './config.ts'

export { createApp }

type SignalName = 'SIGTERM' | 'SIGINT'
type SignalRegistrar = (signal: SignalName, handler: () => Promise<void>) => void

const registerProcessSignal: SignalRegistrar = (signal, handler) => {
  process.once(signal, () => {
    void handler()
  })
}

export function registerGracefulShutdown(
  app: FastifyInstance,
  register: SignalRegistrar = registerProcessSignal
): () => Promise<void> {
  let closePromise: Promise<void> | undefined

  const shutdown = () => {
    closePromise ??= app.close().catch((error: unknown) => {
      app.log.error({ err: error }, 'ARSY graceful shutdown failed')
      process.exitCode = 1
    })
    return closePromise
  }

  register('SIGTERM', shutdown)
  register('SIGINT', shutdown)
  return shutdown
}

export async function startServer() {
  const app = createApp()

  try {
    const { host, port } = resolveServerConfig()
    await app.listen({ host, port })
    app.log.info({ host, port }, 'ARSY Command Center is listening')
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }

  registerGracefulShutdown(app)
  return app
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectExecution) {
  startServer().catch((error: unknown) => {
    console.error('ARSY startup failed:', error)
    process.exitCode = 1
  })
}
