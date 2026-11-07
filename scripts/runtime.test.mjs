import assert from 'node:assert/strict'
import test from 'node:test'
import { assessChangeRisk, extractEnvKeys, parseComposePs } from './runtime.mjs'

test('parses Compose JSON arrays and newline-delimited records', () => {
  assert.deepEqual(parseComposePs('[{"Service":"arsy","State":"running"}]'), [
    { Service: 'arsy', State: 'running' },
  ])
  assert.deepEqual(parseComposePs('{"Service":"arsy"}\n{"Service":"redis"}'), [
    { Service: 'arsy' },
    { Service: 'redis' },
  ])
  assert.deepEqual(parseComposePs(''), [])
})

test('runtime passport environment inventory contains names only', () => {
  assert.deepEqual(extractEnvKeys('DATABASE_URL=postgres://user:secret@host/db\nAPI_KEY=hidden'), [
    'DATABASE_URL',
    'API_KEY',
  ])
})

test('risk gate escalates with blast radius, irirreversibility and uncertainty', () => {
  assert.equal(assessChangeRisk({ blastRadius: 0, irreversibility: 1, uncertainty: 1 }).gate, 'automated-preflight-only')
  assert.equal(assessChangeRisk({ blastRadius: 2, irreversibility: 2, uncertainty: 1 }).gate, 'human-approval')
  assert.equal(assessChangeRisk({ blastRadius: 3, irreversibility: 3, uncertainty: 3 }).gate, 'blocked-until-reviewed')
  assert.throws(() => assessChangeRisk({ blastRadius: 4, irreversibility: 0, uncertainty: 0 }), /0 to 3/)
})
