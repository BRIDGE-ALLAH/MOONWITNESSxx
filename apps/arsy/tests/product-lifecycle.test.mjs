import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionProductLifecycle, nextProductLifecycleStates } from '../src/products/lifecycle.ts'

test('product lifecycle only permits explicit forward or review-return transitions', () => {
  assert.deepEqual(nextProductLifecycleStates('brief'), ['production'])
  assert.deepEqual(nextProductLifecycleStates('production'), ['review'])
  assert.deepEqual(nextProductLifecycleStates('review'), ['production', 'ready'])
  assert.deepEqual(nextProductLifecycleStates('ready'), ['production', 'listed'])
  assert.deepEqual(nextProductLifecycleStates('listed'), ['retired'])
  assert.deepEqual(nextProductLifecycleStates('retired'), [])
})

test('invalid, skipped, and terminal lifecycle transitions are rejected', () => {
  assert.equal(canTransitionProductLifecycle('brief', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('production', 'listed'), false)
  assert.equal(canTransitionProductLifecycle('listed', 'production'), false)
  assert.equal(canTransitionProductLifecycle('retired', 'brief'), false)
  assert.equal(canTransitionProductLifecycle('review', 'ready'), true)
  assert.equal(canTransitionProductLifecycle('ready', 'listed'), true)
})
