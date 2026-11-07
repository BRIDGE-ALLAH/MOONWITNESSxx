import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createActionRegistry,
  createCommandRegistry,
  createPluginSlotRegistry,
  sortPluginSlots,
} from '../dist/platform/index.js'

test('registries reject blank and duplicate IDs', () => {
  const registry = createActionRegistry()
  assert.throws(() => registry.register({ id: '  ', label: 'Blank', run: () => {} }), /must not be empty/)
  const action = { id: 'publish', label: 'Publish', run: () => {} }
  registry.register(action)
  assert.throws(() => registry.register(action), /already registered/)
})

test('unregister is idempotent and cannot remove a newer registration', () => {
  const registry = createCommandRegistry()
  const first = { id: 'open', label: 'Open', run: () => {} }
  const second = { id: 'open', label: 'Open latest', run: () => {} }
  const unregisterFirst = registry.register(first)
  unregisterFirst()
  const unregisterSecond = registry.register(second)
  unregisterFirst()
  assert.equal(registry.get('open'), second)
  unregisterSecond()
  unregisterSecond()
  assert.equal(registry.has('open'), false)
})

test('plugin slots filter disabled entries and sort by priority', () => {
  const registry = createPluginSlotRegistry()
  const component = () => null
  registry.register({ id: 'low', owner: 'core', priority: 1, component })
  registry.register({ id: 'high', owner: 'extension', priority: 10, component })
  registry.register({ id: 'off', owner: 'extension', priority: 99, component, isEnabled: () => false })
  const result = sortPluginSlots(registry.list(), {})
  assert.deepEqual(result.map((slot) => slot.id), ['high', 'low'])
})

test('registries expose deterministic lookup and listing', () => {
  const registry = createActionRegistry()
  const first = { id: 'one', label: 'One', run: () => {} }
  const second = { id: 'two', label: 'Two', run: () => {} }
  registry.register(first)
  registry.register(second)
  assert.equal(registry.get('one'), first)
  assert.equal(registry.has('two'), true)
  assert.deepEqual(registry.list(), [first, second])
})
