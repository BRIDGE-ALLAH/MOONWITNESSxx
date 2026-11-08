import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertImageDigest,
  assertOperationTransition,
  canonicalJson,
  hashCanonicalJson,
} from '../src/deployments/contracts.ts'

test('canonical deployment JSON sorts object keys recursively', () => {
  const left = { z: 1, nested: { b: true, a: 'value' } }
  const right = { nested: { a: 'value', b: true }, z: 1 }
  assert.equal(canonicalJson(left), canonicalJson(right))
  assert.equal(hashCanonicalJson(left), hashCanonicalJson(right))
})

test('deployment metadata rejects secret-bearing and environment-value fields', () => {
  for (const value of [
    { password: 'plaintext' },
    { registryToken: 'plaintext' },
    { privateKey: 'plaintext' },
    { environment: { DATABASE_URL: 'postgres://secret' } },
    { nested: { clientCertificate: 'plaintext' } },
  ]) {
    assert.throws(() => canonicalJson(value), /forbidden secret-bearing field/)
  }
  assert.doesNotThrow(() => canonicalJson({ secretRefs: ['vault://apps/prod/db'], image: 'sha256:abc' }))
})

test('deployment metadata rejects non-JSON values, non-finite numbers and oversize payloads', () => {
  assert.throws(() => canonicalJson({ at: new Date() }), /plain JSON objects/)
  assert.throws(() => canonicalJson({ amount: Number.NaN }), /non-finite number/)
  assert.throws(() => canonicalJson({ data: 'x'.repeat(70 * 1024) }), /64 KiB limit/)
})

test('deployment requires an immutable sha256 OCI digest', () => {
  assert.doesNotThrow(() => assertImageDigest(`sha256:${'a'.repeat(64)}`))
  for (const value of ['latest', 'sha256:abcd', 'sha256:' + 'A'.repeat(64), 'https://registry/image']) {
    assert.throws(() => assertImageDigest(value), /immutable sha256 OCI digest/)
  }
})

test('operation lifecycle rejects illegal transitions and terminal-state reopening', () => {
  assert.doesNotThrow(() => assertOperationTransition('queued', 'running'))
  assert.doesNotThrow(() => assertOperationTransition('running', 'verifying'))
  assert.doesNotThrow(() => assertOperationTransition('verifying', 'succeeded'))
  assert.throws(() => assertOperationTransition('queued', 'succeeded'), /Invalid deployment operation transition/)
  assert.throws(() => assertOperationTransition('succeeded', 'running'), /Invalid deployment operation transition/)
  assert.throws(() => assertOperationTransition('failed', 'queued'), /Invalid deployment operation transition/)
})
