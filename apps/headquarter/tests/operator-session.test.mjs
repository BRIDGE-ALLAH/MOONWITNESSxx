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
  assert.notEqual(getOperatorSessionConfig({
    NODE_ENV: 'production',
    ARSY_OPERATOR_ID: operatorId,
    HEADQUARTER_OPERATOR_PASSWORD: password,
    HEADQUARTER_SESSION_SECRET: secret,
    HEADQUARTER_PUBLIC_ORIGIN: 'https://hq.example',
  }), null)
})

test('operator password comparison and same-origin validation', () => {
  assert.equal(operatorPasswordMatches('correct horse', 'correct horse', secret), true)
  assert.equal(operatorPasswordMatches('incorrect', 'correct horse', secret), false)
  assert.equal(operatorPasswordMatches('correct horse', 'correct horse', 'another-session-secret-that-is-32-bytes'), false)
  assert.equal(operatorPasswordMatches('x'.repeat(1025), password, secret), false)
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
