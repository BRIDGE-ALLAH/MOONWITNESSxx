import assert from 'node:assert/strict'
import test from 'node:test'
import { reconcileOutcome } from '../src/reconciliation/outcome.ts'
const expected = { resourceId: 'deployment:blue', actionId: 'deploy-1', expectedDigest: 'sha256:abc' }
test('confirms a fresh independent observation matching expected state', () => {
  const result = reconcileOutcome(expected, { observedDigest: 'sha256:abc', observedAt: '2026-11-08T00:59:00Z', observerId: 'provider-readback' }, { now: '2026-11-08T01:00:00Z' })
  assert.equal(result.status, 'confirmed')
  assert.equal(result.reopenRequired, false)
})
test('reopens completion on drift, stale observations, or missing readback', () => {
  const drift = reconcileOutcome(expected, { observedDigest: 'sha256:other', observedAt: '2026-11-08T00:59:00Z', observerId: 'provider' }, { now: '2026-11-08T01:00:00Z' })
  const stale = reconcileOutcome(expected, { observedDigest: 'sha256:abc', observedAt: '2026-11-08T00:00:00Z', observerId: 'provider' }, { now: '2026-11-08T01:00:00Z' })
  const missing = reconcileOutcome(expected, {}, { now: '2026-11-08T01:00:00Z' })
  assert.equal(drift.status, 'drift_detected')
  assert.equal(stale.status, 'stale')
  assert.equal(missing.status, 'unavailable')
  assert.ok(drift.reopenRequired && stale.reopenRequired && missing.reopenRequired)
})
