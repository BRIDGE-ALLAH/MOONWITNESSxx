import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionProductLifecycle, nextProductLifecycleStates } from '../src/products/lifecycle.ts'

test('operator lifecycle transitions cannot bypass inspection readiness or publication receipt', () => {
  assert.equal(canTransitionProductLifecycle('brief', 'production'), true)
  assert.equal(canTransitionProductLifecycle('production', 'review'), true)
  assert.equal(canTransitionProductLifecycle('review', 'production'), true)
  assert.equal(canTransitionProductLifecycle('listed', 'retired'), true)

  // These states are owned by their evidence-backed workflows, not this manual endpoint.
  assert.equal(canTransitionProductLifecycle('review', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('ready', 'listed'), false)

  assert.deepEqual(nextProductLifecycleStates('review'), ['production', 'retired'])
  assert.deepEqual(nextProductLifecycleStates('ready'), ['retired'])
  assert.deepEqual(nextProductLifecycleStates('listed'), ['retired'])
  assert.deepEqual(nextProductLifecycleStates('retired'), [])
})

test('retired products are terminal and skipped transitions remain rejected', () => {
  assert.equal(canTransitionProductLifecycle('brief', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('production', 'listed'), false)
  assert.equal(canTransitionProductLifecycle('listed', 'production'), false)
  assert.equal(canTransitionProductLifecycle('retired', 'production'), false)
})
