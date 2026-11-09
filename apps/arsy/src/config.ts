export function resolveServerConfig(env = process.env) {
  const rawPort = env.PORT ?? '3001'
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }
  const host = typeof env.HOST === 'string' && env.HOST.trim() ? env.HOST.trim() : '127.0.0.1'
  return { host, port }
}


export function resolveGlobalRateLimitMax(env = process.env): number {
  const raw = env.ARSY_GLOBAL_RATE_LIMIT_MAX
  if (raw === undefined) return 120
  if (!/^\d+$/.test(raw)) {
    throw new Error('ARSY_GLOBAL_RATE_LIMIT_MAX must be an integer between 1 and 1000')
  }
  const max = Number(raw)
  if (!Number.isSafeInteger(max) || max < 1 || max > 1000) {
    throw new Error('ARSY_GLOBAL_RATE_LIMIT_MAX must be an integer between 1 and 1000')
  }
  return max
}
