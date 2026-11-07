import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const compose = await readFile(new URL('../docker-compose.yml', import.meta.url), 'utf8')

function serviceBlock(name, nextName) {
  const start = compose.indexOf(`  ${name}:\n`)
  assert.notEqual(start, -1, `Missing Compose service: ${name}`)
  const end = nextName
    ? compose.indexOf(`  ${nextName}:\n`, start + 1)
    : compose.indexOf('\nvolumes:\n', start)
  assert.notEqual(end, -1, `Missing end boundary after Compose service: ${name}`)
  return compose.slice(start, end)
}

test('ARSY source mount preserves package dependencies and the internal healthcheck port', () => {
  const arsy = serviceBlock('arsy', 'headquarter')
  assert.ok(arsy.includes('- ./apps/arsy:/app/apps/arsy'))
  assert.ok(arsy.includes('- /app/apps/arsy/node_modules'))
  assert.ok(arsy.includes('- ./packages:/app/packages'))
  assert.ok(arsy.includes('- /app/packages/arsy-core/node_modules'))
  assert.ok(arsy.includes('- /app/node_modules'))
  assert.match(arsy, /PORT: 3001\n/)
  assert.match(arsy, /\$\{ARSY_PORT:-3001\}:3001/)
  assert.match(arsy, /127\.0\.0\.1:3001\/health\/ready/)
  assert.doesNotMatch(arsy, /PORT: \$\{ARSY_PORT/)
})

test('Headquarter source mount preserves app and shared UI dependencies on its internal port', () => {
  const headquarter = serviceBlock('headquarter')
  assert.ok(headquarter.includes('- ./apps/headquarter:/app/apps/headquarter'))
  assert.ok(headquarter.includes('- /app/apps/headquarter/node_modules'))
  assert.ok(headquarter.includes('- ./packages:/app/packages'))
  assert.ok(headquarter.includes('- /app/packages/ui/node_modules'))
  assert.ok(headquarter.includes('- /app/packages/assets/node_modules'))
  assert.ok(headquarter.includes('- /app/node_modules'))
  assert.match(headquarter, /PORT: 3000\n/)
  assert.match(headquarter, /\$\{HEADQUARTER_PORT:-3000\}:3000/)
  assert.match(headquarter, /127\.0\.0\.1:3000/)
  assert.doesNotMatch(headquarter, /PORT: \$\{HEADQUARTER_PORT/)
})

test('application dependency mounts leave the named database and Redis data volumes intact', () => {
  assert.match(compose, /postgres_data:\n\s+driver: local/)
  assert.match(compose, /redis_data:\n\s+driver: local/)
  assert.doesNotMatch(compose, /postgres_data:.*arsy_assets/s)
})

test('database and cache are not coupled to application-only dependency volumes', () => {
  const postgres = serviceBlock('postgres', 'redis')
  const redis = serviceBlock('redis', 'arsy')
  assert.ok(postgres.includes('postgres_data:/var/lib/postgresql/data'))
  assert.ok(redis.includes('redis_data:/data'))
})
