import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidCommitSubject } from './check-commit-message.mjs'
import {
  containsBackgroundShelling,
  containsSuppressedFailure,
  findMissingWorkspaceImporters,
  getProjectLockfileDocument,
} from './repo-audit.mjs'

test('accepts conventional commit subjects with and without scopes', () => {
  assert.equal(isValidCommitSubject('feat: add account settings'), true)
  assert.equal(isValidCommitSubject('fix(arsy): handle shutdown signal'), true)
  assert.equal(isValidCommitSubject('chore(ci): pin workflow toolchain'), true)
  assert.equal(isValidCommitSubject('feat(api)!: remove legacy endpoint'), true)
})

test('rejects subjects without a conventional type or with invalid capitalization', () => {
  assert.equal(isValidCommitSubject('update the app'), false)
  assert.equal(isValidCommitSubject('feature: add dashboard'), false)
  assert.equal(isValidCommitSubject('FEAT: add dashboard'), false)
})

test('enforces a 72-character total subject limit', () => {
  assert.equal(isValidCommitSubject(`chore: ${'x'.repeat(65)}`), true)
  assert.equal(isValidCommitSubject(`chore: ${'x'.repeat(66)}`), false)
  assert.equal(isValidCommitSubject(`chore: ${'x'.repeat(73)}`), false)
})

test('detects shell background processes that can hide child exit codes', () => {
  assert.equal(containsBackgroundShelling('pnpm build & pnpm test'), true)
  assert.equal(containsBackgroundShelling('turbo run build --parallel'), false)
  assert.equal(containsBackgroundShelling('pnpm build && pnpm test'), false)
})

test('detects suppressed failures and fake lint placeholders', () => {
  assert.equal(containsSuppressedFailure('eslint . || true'), true)
  assert.equal(containsSuppressedFailure('eslint . || echo lint-skip'), true)
  assert.equal(containsSuppressedFailure('eslint .'), false)
})

test('reads the project dependency document from pnpm 12 multi-document lockfiles', () => {
  const lockfile = `---
lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
packages:
  pnpm@12.16.1: {}
snapshots:
  pnpm@12.16.1: {}
---
lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
importers:
  .:
    devDependencies:
      prettier:
        specifier: ^3.0.0
        version: 3.0.0
  apps/headquarter:
    dependencies:
      next:
        specifier: 15.1.0
        version: 15.1.0
packages:
  next@15.1.0: {}
snapshots:
  next@15.1.0: {}
`

  const projectDocument = getProjectLockfileDocument(lockfile)
  assert.match(projectDocument, /apps\/headquarter:/)
  assert.deepEqual(findMissingWorkspaceImporters(lockfile, ['apps/headquarter', 'packages/ui']), [
    'packages/ui',
  ])
})

test('reads a single-document lockfile as the project lockfile', () => {
  const lockfile = `---
lockfileVersion: '9.0'
importers:
  .: {}
  apps/arsy: {}
packages: {}
snapshots: {}
`
  assert.deepEqual(findMissingWorkspaceImporters(lockfile, ['apps/arsy']), [])
})

test('recognizes empty workspace importers in pnpm lockfiles', () => {
  const lockfile = `---
lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
packages:
  pnpm@12.16.1: {}
snapshots:
  pnpm@12.16.1: {}
---
lockfileVersion: '9.0'
importers:
  packages/arsy-core: {}
  packages/contract: {}
  packages/lint: {}
packages: {}
snapshots: {}
`

  assert.deepEqual(
    findMissingWorkspaceImporters(lockfile, [
      'packages/arsy-core',
      'packages/contract',
      'packages/lint',
    ]),
    []
  )
})
