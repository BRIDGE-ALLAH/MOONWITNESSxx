import test from 'node:test'
import assert from 'node:assert/strict'

test('snapshotDiff', async (t) => {
  const { computeSnapshotDiff, isLatencySignificant } = await import('../src/lib/snapshotDiff.ts')

  await t.test('status change', () => {
    const prev = [{ id: 'a', name: 'A', status: 'HEALTHY', source: 'backend', latencyMs: 10 }]
    const curr = [{ id: 'a', name: 'A', status: 'OFFLINE', source: 'backend', latencyMs: 10 }]
    const diff = computeSnapshotDiff(prev, curr)
    assert.equal(diff.changes.length, 1)
    assert.equal(diff.changes[0].kind, 'status')
  })

  await t.test('source change', () => {
    const prev = [{ id: 'a', name: 'A', status: 'HEALTHY', source: 'backend', latencyMs: 10 }]
    const curr = [{ id: 'a', name: 'A', status: 'HEALTHY', source: 'frontend', latencyMs: 10 }]
    const diff = computeSnapshotDiff(prev, curr)
    assert.equal(diff.changes.length, 1)
    assert.equal(diff.changes[0].kind, 'source')
  })

  await t.test('latency significant', () => {
    assert.equal(isLatencySignificant(100, 210), true)
    assert.equal(isLatencySignificant(100, 120), false)
    assert.equal(isLatencySignificant(100, 160), true) // 60ms >=50 and 60%
  })

  await t.test('null inputs', () => {
    assert.deepEqual(computeSnapshotDiff(null, null).changes, [])
  })
})
