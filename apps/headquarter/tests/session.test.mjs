import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperatorSession, verifyOperatorSession } from '../src/platform/auth/session.ts'

const secret = 'test-secret-that-is-at-least-thirty-two-characters-long'

test('operator session signature validates and expires', () => {
  const now = 1_800_000_000_000
  const token = createOperatorSession(secret, now)
  assert.equal(verifyOperatorSession(`mw_operator_session=${token}`, secret, now), true)
  assert.equal(verifyOperatorSession(`mw_operator_session=${token}`, secret, now + 8 * 60 * 60 * 1000 + 1), false)
})

test('operator session rejects tampering and missing secrets', () => {
  const token = createOperatorSession(secret, 1_800_000_000_000)
  const tampered = `${token.slice(0, -1)}x`
  assert.equal(verifyOperatorSession(`mw_operator_session=${tampered}`, secret, 1_800_000_000_000), false)
  assert.equal(verifyOperatorSession(`mw_operator_session=${token}`, undefined, 1_800_000_000_000), false)
  assert.equal(verifyOperatorSession(null, secret, 1_800_000_000_000), false)
})

test('session signing rejects weak secrets', () => {
  assert.throws(() => createOperatorSession('too-short'), /32 characters/)
})
