import assert from 'node:assert/strict'
import test from 'node:test'
import { routeReviewQueue } from '../src/review/routing.ts'
test('escalates compromised sources and deterministically orders reviews', () => {
  const result = routeReviewQueue([
    { id: 'normal', severity: 'normal', createdAt: '2026-11-08T00:00:00Z' },
    { id: 'high', severity: 'high', createdAt: '2026-11-08T00:00:00Z', blocksAction: true },
    { id: 'poisoned', severity: 'normal', createdAt: '2026-11-08T00:00:00Z', sourceCompromised: true },
  ], '2026-11-08T01:00:00Z')
  assert.deepEqual(result.map((item) => item.item.id), ['poisoned', 'high', 'normal'])
  assert.ok(result[0].reasonCodes.includes('upstream_source_compromised'))
})
test('rejects duplicate identifiers and invalid timestamps', () => {
  assert.throws(() => routeReviewQueue([{ id: 'x', severity: 'normal', createdAt: 'bad' }]), /Invalid createdAt/)
})
