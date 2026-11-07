import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')

test('development bind mounts preserve pnpm workspace dependency directories', () => {
  for (const workspace of [
    'apps/arsy',
    'apps/headquarter',
    'packages/arsy-core',
    'packages/ui',
    'packages/assets',
  ]) {
    assert.ok(compose.includes(`- /app/${workspace}/node_modules`), workspace)
  }
})

test('host port overrides do not change fixed in-network application ports', () => {
  assert.ok(compose.includes('      PORT: 3001'))
  assert.ok(compose.includes("127.0.0.1:${ARSY_PORT:-3001}:3001"))
  assert.ok(compose.includes('      PORT: 3000'))
  assert.ok(compose.includes("127.0.0.1:${HEADQUARTER_PORT:-3000}:3000"))
})
