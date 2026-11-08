import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionProductLifecycle, nextProductLifecycleStates } from '../src/products/lifecycle.ts'

test('product lifecycle permits explicit work, rework and retirement transitions', () => {
  assert.equal(canTransitionProductLifecycle('brief', 'production'), true)
  assert.equal(canTransitionProductLifecycle('production', 'review'), true)
  assert.equal(canTransitionProductLifecycle('review', 'production'), true)
  assert.equal(canTransitionProductLifecycle('ready', 'production'), false)
  assert.equal(canTransitionProductLifecycle('listed', 'retired'), true)

  assert.deepEqual(nextProductLifecycleStates('brief'), ['production', 'retired'])
  assert.deepEqual(nextProductLifecycleStates('production'), ['review', 'retired'])
  assert.deepEqual(nextProductLifecycleStates('review'), ['production', 'retired'])
  assert.deepEqual(nextProductLifecycleStates('ready'), ['retired'])
  assert.deepEqual(nextProductLifecycleStates('listed'), ['retired'])
  assert.deepEqual(nextProductLifecycleStates('retired'), [])
})

test('inspection readiness and publication receipt cannot be bypassed manually', () => {
  assert.equal(canTransitionProductLifecycle('review', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('ready', 'listed'), false)
  assert.equal(canTransitionProductLifecycle('ready', 'production'), false)
  assert.equal(canTransitionProductLifecycle('brief', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('production', 'listed'), false)
  assert.equal(canTransitionProductLifecycle('listed', 'production'), false)
  assert.equal(canTransitionProductLifecycle('retired', 'production'), false)
})
