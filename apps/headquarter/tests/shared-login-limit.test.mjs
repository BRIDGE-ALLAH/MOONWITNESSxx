import test from 'node:test'
import assert from 'node:assert/strict'
import {
  requestSharedLoginLimit,
  resolveLoginNetworkHash,
} from '../src/lib/shared-login-limit.ts'

const secret = 'test-shared-login-secret-with-at-least-32-bytes'

test('local mode ignores untrusted forwarded headers and uses one local bucket', () => {
  const env = { NODE_ENV: 'development', HEADQUARTER_SESSION_SECRET: secret, HEADQUARTER_TRUSTED_PROXY_HOPS: '0' }
  const first = resolveLoginNetworkHash(new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.1' } }), env)
  const forged = resolveLoginNetworkHash(new Request('http://localhost', { headers: { 'x-forwarded-for': '198.51.100.9' } }), env)
  assert.ok(first)
  assert.equal(first, forged)
})

test('production requires one trusted proxy and a single valid forwarded IP', () => {
  const base = { NODE_ENV: 'production', HEADQUARTER_SESSION_SECRET: secret, HEADQUARTER_TRUSTED_PROXY_HOPS: '1' }
  const valid = resolveLoginNetworkHash(new Request('https://hq.example', { headers: { 'x-forwarded-for': '203.0.113.7' } }), base)
  assert.ok(valid)
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' } }), base), null)
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example', { headers: { 'x-forwarded-for': 'not-an-ip' } }), base), null)
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example'), { ...base, HEADQUARTER_TRUSTED_PROXY_HOPS: '0' }), null)
})

test('network hashes are keyed and distinct for different trusted addresses', () => {
  const env = { NODE_ENV: 'production', HEADQUARTER_SESSION_SECRET: secret, HEADQUARTER_TRUSTED_PROXY_HOPS: '1' }
  const hashA = resolveLoginNetworkHash(new Request('https://hq.example', { headers: { 'x-forwarded-for': '203.0.113.7' } }), env)
  const hashB = resolveLoginNetworkHash(new Request('https://hq.example', { headers: { 'x-forwarded-for': '203.0.113.8' } }), env)
  assert.notEqual(hashA, hashB)
  assert.match(hashA, /^[a-f0-9]{64}$/)
})

test('shared limiter fails closed on missing configuration or unavailable service', async () => {
  await assert.rejects(
    requestSharedLoginLimit(new Request('http://localhost'), 'attempt, { HEADQUARTER_SESSION_SECRET: secret }),
    /SHARED_LOGIN_LIMIT_NOT_CONFIGURED/,
  )
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  try {
    await assert.rejects(
      requestSharedLoginLimit(new Request('http://localhost'), 'attempt, {
        NODE_ENV: 'development',
        HEADQUARTER_SESSION_SECRET: secret,
        ARSY_API_BASE_URL: 'http://arsy.internal',
        ARSY_OPERATOR_TOKEN: 'test-token',
      }),
      /SHARED_LOGIN_LIMIT_UNAVAILABLE/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
