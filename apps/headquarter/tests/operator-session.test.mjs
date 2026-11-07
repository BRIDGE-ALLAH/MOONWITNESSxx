import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOperatorSession,
  getOperatorSessionConfig,
  operatorPasswordMatches,
  readOperatorSessionCookie,
  requestHasTrustedOrigin,
  verifyOperatorSession,
} from '../src/lib/operator-session.ts'

const secret = 'test-session-secret-that-is-at-least-32-bytes-long'
const operatorId = 'operator-test'
const password = 'strong-test-password-at-least-16'

test('signed operator sessions round-trip and expire', () => {
  const now = Date.parse('2026-11-08T00:00:00.000Z')
  const token = createOperatorSession(operatorId, secret, now)
  assert.deepEqual(verifyOperatorSession(token, secret, now), {
    operatorId,
    expiresAt: Math.floor(now / 1000) + 8 * 60 * 60,
  })
  assert.equal(verifyOperatorSession(token, secret, now + 8 * 60 * 60 * 1000), null)
})

test('signed operator sessions reject tampering and wrong secrets', () => {
  const token = createOperatorSession(operatorId, secret)
  const [payload, signature] = token.split('.')
  const tampered = `${payload.slice(0, -1)}A.${signature}`
  assert.equal(verifyOperatorSession(tampered, secret), null)
  assert.equal(verifyOperatorSession(token, 'another-secret-that-is-at-least-32-bytes'), null)
  assert.equal(verifyOperatorSession(undefined, secret), null)
})

test('operator session configuration requires explicit owner and strong secrets', () => {
  assert.equal(getOperatorSessionConfig({}), null)
  assert.equal(getOperatorSessionConfig({
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
  }), null)
  assert.equal(getOperatorSessionConfig({
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
  })?.operatorId, operatorId)
  assert.equal(getOperatorSessionConfig({
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: 'short',
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
  }), null)
  assert.equal(getOperatorSessionConfig({
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example/path',
  }), null)
})

test('production session configuration requires HTTPS', () => {
  assert.equal(getOperatorSessionConfig({
    NODE_ENV: 'production',
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'http://hq.example',
  }), null)
  assert.equal(getOperatorSessionConfig({
    NODE_ENV: 'production',
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
  }), null)
  assert.notEqual(getOperatorSessionConfig({
    NODE_ENV: 'production',
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
    HEADQUARTER_TRUSTED_PROXY_HOPS: '1',
    HEADQUARTER_PROXY_IDENTITY_SECRET: secret,
  }), null)
})

test('operator password comparison and same-origin validation', () => {
  assert.equal(operatorPasswordMatches('correct horse', 'correct horse'), true)
  assert.equal(operatorPasswordMatches('incorrect', 'correct horse'), false)
  const request = new Request('https://hq.example/api/opportunities', {
    method: 'POST',
    headers: { origin: 'https://hq.example' },
  })
  assert.equal(requestHasTrustedOrigin(request, 'https://hq.example'), true)
  assert.equal(requestHasTrustedOrigin(new Request('https://hq.example'), 'https://hq.example'), false)
  assert.equal(requestHasTrustedOrigin(new Request('https://hq.example', {
    headers: { origin: 'https://attacker.example' },
  }), 'https://hq.example'), false)
})

test('operator session cookie is extracted without trusting other cookies', () => {
  const token = createOperatorSession(operatorId, secret)
  const request = new Request('https://hq.example', {
    headers: { cookie: `theme=dark; mw_operator_session=${token}; other=value` },
  })
  assert.equal(readOperatorSessionCookie(request), token)
  assert.equal(readOperatorSessionCookie(new Request('https://hq.example')), undefined)
})


import { createHmac } from 'node:crypto'
import {
  createLoginAttemptBucketHashes,
  resolveTrustedClientNetworkIdentity,
} from '../src/lib/login-attempt-limiter.ts'

test('production login identity requires a signed assertion from the configured trusted ingress', () => {
  const now = Date.parse('2026-11-08T00:00:00.000Z')
  const ip = '198.51.100.42'
  const timestamp = String(Math.floor(now / 1000))
  const signature = createHmac('sha256', secret).update(`${ip}.${timestamp}`).digest('hex')
  const signed = new Request('https://hq.example/login', {
    headers: {
      'x-forwarded-for': '203.0.113.99',
      'x-mw-client-ip': ip,
      'x-mw-client-timestamp': timestamp,
      'x-mw-client-signature': signature,
    },
  })
  assert.equal(resolveTrustedClientNetworkIdentity(signed, 1, secret, 'production', now), ip)
  assert.equal(resolveTrustedClientNetworkIdentity(signed, 0, secret, 'production', now), null)
  const spoofed = new Request('https://hq.example/login', {
    headers: { 'x-forwarded-for': ip, 'x-mw-client-ip': ip, 'x-mw-client-timestamp': timestamp, 'x-mw-client-signature': '0'.repeat(64) },
  })
  assert.equal(resolveTrustedClientNetworkIdentity(spoofed, 1, secret, 'production', now), null)
  assert.equal(resolveTrustedClientNetworkIdentity(new Request('https://hq.example/login', {
    headers: { 'x-forwarded-for': ip },
  }), 1, secret, 'production', now), null)
})

test('untrusted client-supplied forwarding headers never select a network bucket in local mode', () => {
  const first = resolveTrustedClientNetworkIdentity(new Request('https://hq.example/login', {
    headers: { 'x-forwarded-for': '198.51.100.1' },
  }), 0, undefined, 'development')
  const second = resolveTrustedClientNetworkIdentity(new Request('https://hq.example/login', {
    headers: { 'x-forwarded-for': '203.0.113.2' },
  }), 0, 'development')
  assert.equal(first, 'local-development')
  assert.equal(second, 'local-development')
})

test('login bucket identifiers are keyed, deterministic and do not expose raw operator or IP values', () => {
  const first = createLoginAttemptBucketHashes(operatorId, '198.51.100.7', secret)
  const sameNetwork = createLoginAttemptBucketHashes('OPERATOR-TEST', '198.51.100.7', secret)
  const otherNetwork = createLoginAttemptBucketHashes(operatorId, '203.0.113.8', secret)
  assert.deepEqual(first, sameNetwork)
  assert.equal(first.operatorBucketHash, otherNetwork.operatorBucketHash)
  assert.notEqual(first.networkBucketHash, otherNetwork.networkBucketHash)
  assert.match(first.operatorBucketHash, /^[a-f0-9]{64}$/)
  assert.match(first.networkBucketHash, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(first).includes('198.51.100.7'), false)
  assert.equal(JSON.stringify(first).includes(operatorId), false)
})
