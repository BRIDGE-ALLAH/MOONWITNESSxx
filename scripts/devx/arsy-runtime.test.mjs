import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveArsyRuntimeConfig } from '../../apps/arsy/src/config/runtime.ts'

test('ARSY runtime config defaults to a reachable container listener', () => {
  assert.deepEqual(resolveArsyRuntimeConfig({}), { host: '0.0.0.0', port: 3001 })
})

test('ARSY runtime config validates explicit ports and rejects invalid values', () => {
  assert.deepEqual(resolveArsyRuntimeConfig({ HOST: '127.0.0.1', PORT: '8080' }), { host: '127.0.0.1', port: 8080 })
  for (const PORT of ['bad', '0', '-1', '65536', '3000.5']) {
    assert.throws(() => resolveArsyRuntimeConfig({ PORT }), /PORT must be an integer/)
  }
})
