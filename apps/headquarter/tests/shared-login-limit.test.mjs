import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolveLoginNetworkHash } from '../src/lib/shared-login-limit.ts'

test('production login throttling requires one trusted proxy hop and one canonical client IP', () => {
  const production = { NODE_ENV: 'production', HEADQUARTER_TRUSTED_PROXY_HOPS: '1' }
  const valid = new Request('https://hq.example/api/auth/session', {
    headers: { 'x-forwarded-for': '203.0.113.10' },
  })
  assert.equal(resolveLoginNetworkHash(valid, production), createHash('sha256').update('203.0.113.10').digest('hex'))
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example'), production), null)
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example', {
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
  }), production), null)
  assert.equal(resolveLoginNetworkHash(new Request('https://hq.example', {
    headers: { 'x-forwarded-for': 'not-an-ip' },
  }), production), null)
  assert.equal(resolveLoginNetworkHash(valid, { ...production, HEADQUARTER_TRUSTED_PROXY_HOPS: '2' }), null)
})

test('development mode ignores untrusted forwarded addresses by default', () => {
  const request = new Request('http://localhost:3000/api/auth/session', {
    headers: { 'x-forwarded-for': '198.51.100.20' },
  })
  const first = resolveLoginNetworkHash(request, { NODE_ENV: 'development' })
  const second = resolveLoginNetworkHash(new Request('http://localhost:3000'), { NODE_ENV: 'development' })
  assert.equal(first, second)
  assert.equal(first, createHash('sha256').update('local-development-network').digest('hex'))
})
