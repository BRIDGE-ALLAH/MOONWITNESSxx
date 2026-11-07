import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')

function serviceBlock(name, nextName) {
  const start = compose.indexOf(`  ${name}:\n`)
  assert.notEqual(start, -1, `Missing Compose service: ${name}`)
  const end = nextName ? compose.indexOf(`  ${nextName}:\n`, start + 1) : compose.indexOf('\nvolumes:\n', start)
  assert.notEqual(end, -1, `Missing end boundary after Compose service: ${name}`)
  return compose.slice(start, end)
}

test('ARSY source bind mount preserves its own and its shared package dependencies', () => {
  const arsy = serviceBlock('arsy', 'headquarter')
  assert.ok(arsy.includes('- ./apps/arsy:/app/apps/arsy'))
  assert.ok(arsy.includes('- /app/apps/arsy/node_modules'))
  assert.ok(arsy.includes('- ./packages:/app/packages'))
  assert.ok(arsy.includes('- /app/packages/arsy-core/node_modules'))
  assert.ok(arsy.includes('- /app/node_modules'))
})

test('Headquarter source bind mount preserves its own and UI package dependencies', () => {
  const headquarter = serviceBlock('headquarter')
  assert.ok(headquarter.includes('- ./apps/headquarter:/app/apps/headquarter'))
  assert.ok(headquarter.includes('- /app/apps/headquarter/node_modules'))
  assert.ok(headquarter.includes('- ./packages:/app/packages'))
  assert.ok(headquarter.includes('- /app/packages/ui/node_modules'))
  assert.ok(headquarter.includes('- /app/packages/assets/node_modules'))
  assert.ok(headquarter.includes('- /app/node_modules'))
})

test('workspace dependency volumes do not replace the named data volumes', () => {
  assert.match(compose, /postgres_data:\n\s+driver: local/)
  assert.match(compose, /redis_data:\n\s+driver: local/)
})
