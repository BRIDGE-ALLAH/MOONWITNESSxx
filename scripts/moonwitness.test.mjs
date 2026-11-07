import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildInstallCommand, extractEnvKeys, parseArgs, runCli } from './moonwitness.mjs'

test('parses supported setup options and rejects unknown profiles', () => {
  assert.deepEqual(parseArgs(['install', '--profile', 'arsy', '--offline']), {
    command: 'install',
    profile: 'arsy',
    offline: true,
    dryRun: false,
    root: null,
  })
  assert.throws(() => parseArgs(['install', '--profile', 'production']), /Unknown profile/)
})

test('builds pinned, frozen profile-specific install commands', () => {
  assert.deepEqual(buildInstallCommand('minimal'), {
    command: 'pnpm',
    args: ['install', '--frozen-lockfile', '--filter', '.'],
  })
  assert.deepEqual(buildInstallCommand('headquarter', true), {
    command: 'pnpm',
    args: ['install', '--frozen-lockfile', '--filter', '@riotworks/headquarter...', '--offline'],
  })
  assert.deepEqual(buildInstallCommand('full-dev'), {
    command: 'pnpm',
    args: ['install', '--frozen-lockfile'],
  })
})

test('extracts environment variable names without retaining values', () => {
  const keys = extractEnvKeys(
    'TOKEN=super-secret\n# comment\n DATABASE_URL = postgres://user:pass@host/db\n'
  )
  assert.deepEqual(keys, ['TOKEN', 'DATABASE_URL'])
  assert.equal(JSON.stringify(keys).includes('super-secret'), false)
})

test('dry-run does not create .env, node_modules, or install state', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'moonwitness-installer-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@12.16.1' }))
  const result = await runCli(['install', '--profile', 'minimal', '--dry-run'], root)
  assert.equal(result, undefined)
  await assert.rejects(readFile(join(root, '.env')))
  await assert.rejects(readFile(join(root, '.moonwitness/install-state.json')))
})

test('uninstall removes only the generated state marker', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'moonwitness-uninstall-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, '.moonwitness'), { recursive: true })
  await writeFile(join(root, '.moonwitness/install-state.json'), '{}')
  await writeFile(join(root, '.env'), 'TOKEN=keep-me\n')
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await runCli(['uninstall'], root)
  await assert.rejects(readFile(join(root, '.moonwitness/install-state.json')))
  assert.equal(await readFile(join(root, '.env'), 'utf8'), 'TOKEN=keep-me\n')
})
