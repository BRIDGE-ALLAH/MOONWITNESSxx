import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  analyzeObjectiveProgress,
  appendFlightRecord,
  compileRepoContext,
  createChangePlan,
  createContextLease,
  createResourcePassport,
  forecastInterfaceConflicts,
  forecastResourceCollisions,
  forecastWriteCollisions,
  parseMajorVersion,
  runDoctor,
  verifyContextLease,
  verifyFlightRecorder,
} from './lib.mjs'

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
  const result = await compileRepoContext({ root, maxChars: 3000, format: 'json' })
  assert.equal(result.truncated, true)
  assert.equal(result.fingerprint.length, 64)
  assert.ok(result.content.length <= 3000)
  const parsed = JSON.parse(result.content)
  assert.equal(parsed.fingerprint, result.fingerprint)
  assert.equal((parsed.sections ?? []).some((section) => section.path === '.env' || section.path.startsWith('.env.')), false)
})

test('context compiler emits machine-readable JSON when requested', async () => {
  const result = await compileRepoContext({ root, maxChars: 12000, format: 'json' })
  const parsed = JSON.parse(result.content)
  assert.equal(parsed.schemaVersion, 1)
  assert.equal(parsed.fingerprint, result.fingerprint)
  assert.ok(Array.isArray(parsed.packages))
})


test('flight recorder serializes concurrent appends and verifies its hash chain', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moonwitness-flight-'))
  try {
    await Promise.all([
      appendFlightRecord({ root, record: { task: 'one', apiKey: 'secret-value', exitCode: 0 } }),
      appendFlightRecord({ root, record: { task: 'two', exitCode: 0 } }),
      appendFlightRecord({ root, record: { task: 'three', exitCode: 1 } }),
    ])
    const verified = await verifyFlightRecorder({ root })
    assert.equal(verified.valid, true)
    assert.equal(verified.records.length, 3)
    assert.deepEqual(verified.records.map((entry) => entry.sequence), [1, 2, 3])
    assert.equal(verified.records[0].record.apiKey, '[REDACTED]')
    const path = join(root, '.moonwitness', 'flight-recorder.jsonl')
    const lines = (await readFile(path, 'utf8')).trim().split(/\r?\n/)
    const tampered = JSON.parse(lines[1])
    tampered.record.exitCode = 99
    lines[1] = JSON.stringify(tampered)
    await writeFile(path, lines.join('\n') + '\n')
    const corrupted = await verifyFlightRecorder({ root })
    assert.equal(corrupted.valid, false)
    assert.equal(corrupted.reason, 'hash_mismatch_at_line_2')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('parallel collision forecast detects exact and ancestor write conflicts', () => {
  const report = forecastWriteCollisions({ agents: [
    { id: 'agent-a', writePaths: ['packages/core/src/index.ts', 'docs/'] },
    { id: 'agent-b', writePaths: ['packages/core/src/index.ts', 'docs/design.md'] },
    { id: 'agent-c', writePaths: ['apps/web/src/page.tsx'] },
  ] })
  assert.equal(report.safeToParallelize, false)
  assert.ok(report.collisions.some((item) => item.kind === 'same-path' && item.severity === 'critical'))
  assert.ok(report.collisions.some((item) => item.kind === 'ancestor-overlap' && item.severity === 'high'))
  assert.throws(() => forecastWriteCollisions({ agents: [{ id: 'bad', writePaths: ['../secrets'] }] }), /unsafe write path/)
  assert.throws(() => forecastWriteCollisions({ agents: [{ id: 'bad', writePaths: ['/etc/passwd'] }] }), /unsafe write path/)
})

test('parallel collision forecast allows disjoint agent write sets', () => {
  const report = forecastWriteCollisions({ agents: [
    { id: 'agent-a', writePaths: ['packages/a/src'] },
    { id: 'agent-b', writePaths: ['packages/b/src'] },
  ] })
  assert.equal(report.safeToParallelize, true)
  assert.equal(report.collisions.length, 0)
})

test('context lease invalidates changed or expired repository context', () => {
  const fingerprint = 'a'.repeat(64)
  const lease = createContextLease({ fingerprint, generatedAt: '2026-11-08T00:00:00.000Z', ttlMs: 60000 })
  assert.equal(verifyContextLease({ lease, currentFingerprint: fingerprint, now: '2026-11-08T00:00:30.000Z' }).valid, true)
  assert.deepEqual(verifyContextLease({ lease, currentFingerprint: 'b'.repeat(64), now: '2026-11-08T00:00:30.000Z' }), { valid: false, reason: 'context_fingerprint_changed' })
  assert.deepEqual(verifyContextLease({ lease, currentFingerprint: fingerprint, now: '2026-11-08T00:01:00.000Z' }), { valid: false, reason: 'context_lease_expired' })
  assert.deepEqual(verifyContextLease({ lease: { ...lease, ttlMs: 999 }, currentFingerprint: fingerprint, now: '2026-11-08T00:00:30.000Z' }), { valid: false, reason: 'lease_duration_mismatch' })
  assert.deepEqual(verifyContextLease({ lease, currentFingerprint: fingerprint, now: '2026-11-07T23:59:59.000Z' }), { valid: false, reason: 'lease_not_yet_valid' })
  assert.throws(() => createContextLease({ fingerprint: 'invalid' }), /SHA-256/)
})


test('objective watchdog detects repeated unresolved gaps despite activity changes',()=>{
 const steps=[{failedTests:['api'],missingCriteria:['pagination'],activity:'docs'},{failedTests:['api'],missingCriteria:['pagination'],activity:'refactor'},{failedTests:['api'],missingCriteria:['pagination'],activity:'rename'}]
 const r=analyzeObjectiveProgress({steps,repeatThreshold:3});assert.equal(r.stalled,true);assert.equal(r.consecutiveUnchangedGap,3)
 assert.equal(analyzeObjectiveProgress({steps:[steps[0],{failedTests:[],missingCriteria:[]}]}).stalled,false)
})
test('objective gap fingerprints ignore array order and reject weak thresholds',()=>{
 assert.equal(analyzeObjectiveProgress({steps:[{blockers:['db','api']},{blockers:['api','db']}],repeatThreshold:2}).stalled,true)
 assert.throws(()=>analyzeObjectiveProgress({steps:[{}],repeatThreshold:1}),/>= 2/)
})
test('interface treaties catch breaking changes consumed by another agent',()=>{
 const r=forecastInterfaceConflicts({now:'2026-11-08T00:00:00Z',treaties:[
 {id:'producer',owner:'api',provides:['User.v1'],breakingChanges:['User.v1'],expiresAt:'2027-01-01T00:00:00Z'},
 {id:'consumer',owner:'web',consumes:['user.v1'],expiresAt:'2027-01-01T00:00:00Z'}]})
 assert.equal(r.safeToIntegrate,false);assert.ok(r.conflicts.some(x=>x.kind==='breaking-change-consumed'))
})
test('interface treaties reject expired and duplicate declarations',()=>{
 const r=forecastInterfaceConflicts({now:'2026-11-08T00:00:00Z',treaties:[
 {id:'a',owner:'one',provides:['X','x'],expiresAt:'2026-01-01T00:00:00Z'}]})
 assert.ok(r.violations.includes(undefined)===false);assert.ok(r.violations.some(x=>x.code==='treaty_expired'));assert.ok(r.violations.some(x=>x.code==='duplicate_provided_interface'))
})
test('resource passports namespace non-port resources and validate ports',()=>{
 const p=createResourcePassport({agentId:'agent-a',resources:{ports:[3100],databases:['app']}})
 assert.equal(p.namespaced.databases[0],'mw-agent-a-app');assert.throws(()=>createResourcePassport({agentId:'bad/id'}),/safe/)
 assert.throws(()=>createResourcePassport({agentId:'ok',resources:{ports:[70000]}}),/between 1 and 65535/)
})
test('resource forecast detects port and shared-resource collisions',()=>{
 const r=forecastResourceCollisions({agents:[
 {id:'a',resources:{ports:[3000],databases:['shared'],queues:['jobs']}},
 {id:'b',resources:{ports:[3000],databases:['shared'],queues:['jobs']}}]})
 assert.equal(r.safeToLaunchTogether,false);assert.equal(r.collisions.length,3)
 assert.equal(forecastResourceCollisions({agents:[{id:'a',resources:{ports:[3001]}},{id:'b',resources:{ports:[3002]}}]}).safeToLaunchTogether,true)
})
