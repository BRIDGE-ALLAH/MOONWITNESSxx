import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { auditHeadquarterExperience, auditReleaseReadiness, auditWorkspaceContracts } from './product-audit.mjs'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'moonwitness-product-audit-'))
  await mkdir(join(root, 'apps/api'), { recursive: true })
  await mkdir(join(root, 'packages/core'), { recursive: true })
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n  - "packages/*"\n')
  await writeFile(join(root, 'apps/api/package.json'), JSON.stringify({
    name: '@test/api',
    scripts: { build: 'tsc --noEmit false', start: 'node dist/index.js' },
    dependencies: { '@test/core': 'workspace:*' },
  }))
  await writeFile(join(root, 'packages/core/package.json'), JSON.stringify({ name: '@test/core' }))
  return root
}

test('workspace audit validates unique names and resolvable workspace dependencies', async () => {
  const root = await fixture()
  try {
    const report = await auditWorkspaceContracts({ root })
    assert.equal(report.ok, true)
    assert.equal(report.packageCount, 2)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('workspace audit rejects missing workspace dependencies and success-masking scripts', async () => {
  const root = await fixture()
  try {
    await writeFile(join(root, 'apps/api/package.json'), JSON.stringify({
      name: '@test/api',
      scripts: { lint: 'echo lint-skip' },
      dependencies: { '@test/missing': 'workspace:*' },
    }))
    const report = await auditWorkspaceContracts({ root })
    assert.equal(report.ok, false)
    assert.ok(report.findings.some((item) => item.id === 'unresolved-workspace-dependency'))
    assert.ok(report.findings.some((item) => item.id === 'success-masking-script'))
  } finally { await rm(root, { recursive: true, force: true }) }
})


test('workspace audit rejects traversal globs and never scans outside the repository root', async () => {
  const root = await fixture()
  const sibling = join(dirname(root), basename(root) + '-outside')
  try {
    await mkdir(sibling, { recursive: true })
    await writeFile(join(sibling, 'package.json'), JSON.stringify({ name: '@outside/escape' }))
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "../*"\n')
    const report = await auditWorkspaceContracts({ root })
    assert.equal(report.ok, false)
    assert.ok(report.findings.some((item) => item.id === 'unsupported-workspace-pattern'))
    assert.equal(report.packages.some((item) => item.name === '@outside/escape'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(sibling, { recursive: true, force: true })
  }
})

test('Headquarter audit checks navigation-to-route integrity and persistent disclosure', async () => {
  const root = await fixture()
  try {
    await mkdir(join(root, 'apps/headquarter/src/app/overview'), { recursive: true })
    await mkdir(join(root, 'apps/headquarter/src/shell'), { recursive: true })
    await writeFile(join(root, 'apps/headquarter/src/app/overview/page.tsx'), 'export default function Page() { return null }')
    await writeFile(join(root, 'apps/headquarter/src/shell/navigation.ts'), "export const items = [{ href: '/overview', label: 'Overview', status: 'prototype' }]")
    await writeFile(join(root, 'apps/headquarter/src/shell/topbar.tsx'), '<Badge role="status" aria-label={labels.demo}>{labels.demo}</Badge>')
    const report = await auditHeadquarterExperience({ root })
    assert.equal(report.ok, true)
    assert.equal(report.routeCount, 1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('Headquarter audit fails closed on missing routes and absent demo disclosure', async () => {
  const root = await fixture()
  try {
    await mkdir(join(root, 'apps/headquarter/src/app'), { recursive: true })
    await mkdir(join(root, 'apps/headquarter/src/shell'), { recursive: true })
    await writeFile(join(root, 'apps/headquarter/src/shell/navigation.ts'), "export const items = [{ href: '/missing', label: 'Missing', status: 'prototype' }]")
    await writeFile(join(root, 'apps/headquarter/src/shell/topbar.tsx'), '<header />')
    const report = await auditHeadquarterExperience({ root })
    assert.equal(report.ok, false)
    assert.ok(report.findings.some((item) => item.id === 'navigation-route-missing'))
    assert.ok(report.findings.some((item) => item.id === 'persistent-demo-disclosure-missing'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('release preflight reports absent release/deploy workflows and an empty changelog gate', async () => {
  const root = await fixture()
  try {
    await mkdir(join(root, '.github/workflows'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.1.0' }))
    await writeFile(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [1.0.0] - 2026-01-01\n')
    await writeFile(join(root, 'Dockerfile.arsy'), 'CMD ["pnpm", "dev"]')
    const report = await auditReleaseReadiness({ root })
    assert.equal(report.ready, false)
    assert.ok(report.findings.some((item) => item.id === 'unreleased-changelog-empty'))
    assert.ok(report.findings.some((item) => item.id === 'package-changelog-version-mismatch'))
    assert.ok(report.findings.some((item) => item.id === 'release-workflow-missing'))
    assert.ok(report.findings.some((item) => item.id === 'production-deployment-workflow-missing'))
    assert.ok(report.findings.some((item) => item.id === 'arsy-production-entrypoint-invalid'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('release preflight accepts local scaffolding but states its remote verification limit', async () => {
  const root = await fixture()
  try {
    await mkdir(join(root, '.github/workflows'), { recursive: true })
    await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.1.0' }))
    await writeFile(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n### Added\n- Feature.\n\n## [1.1.0] - 2026-01-01\n')
    await writeFile(join(root, '.github/workflows/release.yml'), 'name: Release')
    await writeFile(join(root, '.github/workflows/deploy-production.yml'), 'name: Deploy')
    await writeFile(join(root, 'Dockerfile.arsy'), 'CMD ["pnpm", "start"]')
    await writeFile(join(root, 'Dockerfile.headquarter'), 'CMD ["pnpm", "start"]')
    await writeFile(join(root, 'docker-compose.yml'), 'services:\n  api:\n    healthcheck: true\n  web:\n    healthcheck: true\n')
    const report = await auditReleaseReadiness({ root })
    assert.equal(report.ready, true)
    assert.match(report.note, /cannot verify remote tags/)
  } finally { await rm(root, { recursive: true, force: true }) }
})


test('current repository workspace and Headquarter navigation contracts are coherent', async () => {
  const root = new URL('../..', import.meta.url).pathname
  const workspace = await auditWorkspaceContracts({ root })
  const experience = await auditHeadquarterExperience({ root })
  assert.equal(workspace.ok, true, JSON.stringify(workspace.findings))
  assert.equal(experience.ok, true, JSON.stringify(experience.findings))
})
