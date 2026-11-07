export function resolveServerConfig(env = process.env) {
  const rawPort = env.PORT ?? '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  const host = typeof env.HOST === 'string' && env.HOST.trim() ? env.HOST.trim() : '127.0.0.1'
  return { host, port }
}
