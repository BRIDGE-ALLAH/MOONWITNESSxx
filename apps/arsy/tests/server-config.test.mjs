import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveServerConfig } from '../src/config.ts'

test('server config defaults to loopback and the Compose-mapped ARSY port', () => {
  assert.deepEqual(resolveServerConfig({}), { host: '127.0.0.1', port: 3001 })
})

test('server config honors validated host and port overrides', () => {
  assert.deepEqual(resolveServerConfig({ HOST: '0.0.0.0', PORT: '3002' }), { host: '0.0.0.0', port: 3002 })
})

test('server config rejects malformed and out-of-range ports', () => {
  for (const PORT of ['0', '65536', '3.5', 'abc', '']) {
    assert.throws(() => resolveServerConfig({ PORT }), /PORT must be an integer/)
  }
})


test('global ARSY rate limit defaults to 120 requests per minute', async () => {
  const { resolveGlobalRateLimitMax } = await import('../src/config.ts')
  assert.equal(resolveGlobalRateLimitMax({}), 120)
})

test('global ARSY rate limit accepts a bounded operator override', async () => {
  const { resolveGlobalRateLimitMax } = await import('../src/config.ts')
  assert.equal(resolveGlobalRateLimitMax({ ARSY_GLOBAL_RATE_LIMIT_MAX: '1000' }), 1000)
})

test('global ARSY rate limit rejects malformed and out-of-range overrides', async () => {
  const { resolveGlobalRateLimitMax } = await import('../src/config.ts')
  for (const ARSY_GLOBAL_RATE_LIMIT_MAX of ['', '0', '1001', '3.5', 'abc']) {
    assert.throws(
      () => resolveGlobalRateLimitMax({ ARSY_GLOBAL_RATE_LIMIT_MAX }),
      /ARSY_GLOBAL_RATE_LIMIT_MAX must be an integer between 1 and 1000/,
    )
  }
})
