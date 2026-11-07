import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { analyzeGovernance } from './governance.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'moonwitness-governance-'))
  const put = async (path, value) => {
    const target = join(root, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, value)
  }
  await put('package.json', JSON.stringify({
    name: 'moonwitness',
    engines: { node: '>=22' },
    packageManager: 'pnpm@12.16.1',
    scripts: {
      'governance:check': 'node scripts/governance.mjs check',
      'governance:doctor': 'node scripts/governance.mjs doctor',
      'governance:report': 'node scripts/governance.mjs report',
    },
  }))
  await put('pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n  - 'packages/*'\n")
  await put('AGENTS.md', '# Instructions\n')
  await put('governance/README.md', '# Governance\n1. Approved security and safety constraints.\n2. governance/contracts are authoritative.\n')
  await put('governance/enforcement.md', [
    '# Enforcement',
    '- **REP-01** — Example rule',
    '  - Enforcement: deterministic test',
    '  - State: CI active',
    '',
  ].join('\n'))
  await put('apps/headquarter/package.json', JSON.stringify({
    name: '@riotworks/headquarter',
    private: true,
    dependencies: { '@riotworks/contracts': 'workspace:*' },
  }))
  await put('packages/contracts/package.json', JSON.stringify({
    name: '@riotworks/contracts',
    private: true,
    exports: { '.': './src/index.ts' },
  }))
  await put('packages/contracts/src/index.ts', 'export type Contract = { id: string }\n')
  return { root, put }
}

test('governance engine accepts a valid minimal workspace', async t => {
  const { root } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  const report = await analyzeGovernance(root)
  assert.equal(report.counts.error, 0)
  assert.equal(report.workspacePackages, 2)
})

test('governance engine rejects package-to-app dependency edges', async t => {
  const { root, put } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await put('packages/contracts/package.json', JSON.stringify({
    name: '@riotworks/contracts',
    private: true,
    dependencies: { '@riotworks/headquarter': 'workspace:*' },
  }))
  const report = await analyzeGovernance(root)
  assert.ok(report.findings.some(item => item.code === 'GOV-PACKAGE-TO-APP'))
})

test('governance engine rejects duplicate workspace package names', async t => {
  const { root, put } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await put('apps/arsy/package.json', JSON.stringify({
    name: '@riotworks/contracts',
    private: true,
  }))
  const report = await analyzeGovernance(root)
  assert.ok(report.findings.some(item => item.code === 'GOV-DUPLICATE-PACKAGE'))
})

test('governance engine checks rule completeness and unique IDs', async t => {
  const { root, put } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await put('governance/enforcement.md', [
    '- **REP-01** — First rule',
    '  - Enforcement: test',
    '  - State: CI active',
    '- **REP-01** — Duplicate rule',
    '  - Enforcement: missing state',
  ].join('\n'))
  const report = await analyzeGovernance(root)
  assert.ok(report.findings.some(item => item.code === 'GOV-DUPLICATE-RULE-ID'))
  assert.ok(report.findings.some(item => item.code === 'GOV-RULE-INCOMPLETE'))
})

test('report analysis is read-only and does not create artifacts', async t => {
  const { root } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  const report = await analyzeGovernance(root)
  assert.ok(report.result)
  await assert.rejects(access(join(root, '.artifacts')))
})

test('governance engine rejects forbidden scoped source imports', async t => {
  const { root, put } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await put('packages/contracts/src/leak.ts', "import type { AppProps } from '@riotworks/headquarter'\\n")
  const report = await analyzeGovernance(root)
  assert.ok(report.findings.some(item => item.code === 'GOV-SOURCE-PACKAGE-TO-APP'))
})

test('governance engine reports rule coverage without writing files', async t => {
  const { root } = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  const report = await analyzeGovernance(root)
  assert.deepEqual(report.ruleCoverage, { total: 1, withEnforcement: 1, withState: 1, complete: 1 })
})
