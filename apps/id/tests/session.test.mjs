import test from 'node:test'
import assert from 'node:assert/strict'
import { issueSessionToken, verifySessionToken } from '../src/lib/session.ts'

test('session token issuance & cryptographic verification', async (t) => {
  await t.test('issues signed token with valid structure and claims', () => {
    const { token, claims } = issueSessionToken('operator.alice', 'admin')
    assert.ok(token)
    assert.equal(claims.sub, 'operator.alice')
    assert.equal(claims.role, 'admin')
    assert.equal(typeof claims.iat, 'number')
    assert.equal(typeof claims.exp, 'number')
    assert.ok(claims.exp > claims.iat)

    const parts = token.split('.')
    assert.equal(parts.length, 2)
  })

  await t.test('verifies valid token successfully', () => {
    const { token } = issueSessionToken('service.arsy', 'operator')
    const result = verifySessionToken(token)
    assert.equal(result.valid, true)
    assert.equal(result.claims?.sub, 'service.arsy')
    assert.equal(result.claims?.role, 'operator')
  })

  await t.test('fails closed on tampered signature', () => {
    const { token } = issueSessionToken('operator.bob', 'operator')
    const [payload, sig] = token.split('.')
    const tampered = `${payload}.${sig.slice(0, -2)}xx`
    const result = verifySessionToken(tampered)
    assert.equal(result.valid, false)
    assert.match(result.error, /tampered|invalid/i)
  })

  await t.test('fails closed on expired token', () => {
    const { token } = issueSessionToken('operator.old', 'guest', 'universe', -10)
    const result = verifySessionToken(token)
    assert.equal(result.valid, false)
    assert.match(result.error, /expired/i)
  })

  await t.test('fails closed on malformed input', () => {
    assert.equal(verifySessionToken('').valid, false)
    assert.equal(verifySessionToken('invalid-structure').valid, false)
    assert.equal(verifySessionToken('foo.bar.baz').valid, false)
  })
})
