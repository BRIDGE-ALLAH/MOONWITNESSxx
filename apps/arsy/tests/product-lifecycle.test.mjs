import test from 'node:test'
import assert from 'node:assert/strict'
import { canTransitionProductLifecycle, nextProductLifecycleStates } from '../src/products/lifecycle.ts'

test('product lifecycle permits only explicit forward transitions', () => {
  assert.equal(canTransitionProductLifecycle('brief', 'production'), true)
  assert.equal(canTransitionProductLifecycle('production', 'review'), true)
  assert.equal(canTransitionProductLifecycle('review', 'ready'), false)
  assert.deepEqual(nextProductLifecycleStates('review'), ['production'])
  assert.equal(canTransitionProductLifecycle('ready', 'listed'), true)
  assert.equal(canTransitionProductLifecycle('listed', 'retired'), true)
  assert.equal(canTransitionProductLifecycle('brief', 'ready'), false)
  assert.equal(canTransitionProductLifecycle('listed', 'production'), false)
  assert.equal(canTransitionProductLifecycle('retired', 'production'), false)
  assert.deepEqual(nextProductLifecycleStates('retired'), [])
})
