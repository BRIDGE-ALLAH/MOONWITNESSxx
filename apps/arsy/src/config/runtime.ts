export interface ArsyRuntimeConfig {
  host: string
  port: number
}

/** Resolve and validate the HTTP listener configuration before opening sockets. */
export function resolveArsyRuntimeConfig(
  environment: Record<string, string | undefined>,
): ArsyRuntimeConfig {
  const rawPort = environment.PORT ?? '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  const host = environment.HOST?.trim() || '0.0.0.0'
  return { host, port }
}
