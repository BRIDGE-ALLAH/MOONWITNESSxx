import assert from 'node:assert/strict'
import test from 'node:test'
import { compileRepoContext, createChangePlan, parseMajorVersion, runDoctor } from './lib.mjs'

const root = new URL('../..', import.meta.url).pathname

test('parses Node versions and rejects malformed versions', () => {
  assert.equal(parseMajorVersion('v24.1.0'), 24)
  assert.equal(parseMajorVersion('22.0.0'), 22)
  assert.equal(parseMajorVersion('not-a-version'), null)
})

test('doctor reports toolchain and workspace checks without changing files', async () => {
  const report = await runDoctor({ root, nodeVersion: 'v24.0.0', pnpmVersion: '12.16.1' })
  assert.equal(report.expectedPnpm, '12.16.1')
  assert.equal(report.findings.find((item) => item.id === 'node-version').status, 'pass')
  assert.equal(report.findings.find((item) => item.id === 'pnpm-version').status, 'pass')
  assert.ok(report.packageCount > 0)
})

test('change planner includes dependents of a changed workspace package', async () => {
  const plan = await createChangePlan({ root, changedFiles: ['packages/arsy-core/src/index.ts'] })
  assert.ok(plan.directPackages.includes('@riotworks/arsy-core'))
  assert.ok(plan.impactedPackages.includes('@riotworks/arsy'))
  assert.ok(plan.tasks.some((task) => task.package === '@riotworks/arsy-core'))
})

test('root configuration changes conservatively impact every workspace package', async () => {
  const plan = await createChangePlan({ root, changedFiles: ['turbo.json'] })
  assert.ok(plan.impactedPackages.length >= plan.directPackages.length)
  assert.equal(plan.directPackages.length, plan.impactedPackages.length)
})

test('context compiler is bounded, fingerprinted and excludes secret files', async () => {
  const result = await compileRepoContext({ root, maxChars: 3000 })
  assert.equal(result.truncated, true)
  assert.equal(result.fingerprint.length, 64)
  assert.ok(result.content.length <= 3000)
  assert.equal(result.content.includes('.env'), false)
  assert.equal(result.content.includes('node_modules/.bin'), false)
})

test('context compiler emits machine-readable JSON when requested', async () => {
  const result = await compileRepoContext({ root, maxChars: 12000, format: 'json' })
  const parsed = JSON.parse(result.content)
  assert.equal(parsed.schemaVersion, 1)
  assert.equal(parsed.fingerprint, result.fingerprint)
  assert.ok(Array.isArray(parsed.packages))
})
