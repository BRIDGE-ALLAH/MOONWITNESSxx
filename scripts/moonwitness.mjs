#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const STATE_PATH = '.moonwitness/install-state.json'
const MIN_NODE_MAJOR = 20

export function parseArgs(argv) {
  const [command = 'help', ...rest] = argv
  const options = { command, profile: null, offline: false, dryRun: false, root: null }
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]
    if (value === '--profile') {
      options.profile = rest[++index]
    } else if (value === '--root') {
      options.root = rest[++index]
    } else if (value === '--offline') {
      options.offline = true
    } else if (value === '--dry-run') {
      options.dryRun = true
    } else if (value === '--help' || value === '-h') {
      options.command = 'help'
    } else {
      throw new Error(`Unknown option: ${value}`)
    }
  }
  if (options.profile && !['minimal', 'headquarter', 'arsy', 'full-dev'].includes(options.profile)) {
    throw new Error(`Unknown profile: ${options.profile}`)
  }
  return options
}

export function buildInstallCommand(profile, offline = false) {
  const filters = {
    minimal: ['--filter', '.'],
    headquarter: ['--filter', '@riotworks/headquarter...'],
    arsy: ['--filter', '@riotworks/arsy...'],
    'full-dev': [],
  }
  if (!filters[profile]) throw new Error(`Unknown profile: ${profile}`)
  const args = ['install', '--frozen-lockfile', ...filters[profile]]
  if (offline) args.push('--offline')
  return { command: 'pnpm', args }
}

export function extractEnvKeys(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function resolvePackageManager(root) {
  const manifest = await readJson(join(root, 'package.json'))
  const expected = String(manifest.packageManager ?? '').replace(/^pnpm@/, '')
  if (!expected) throw new Error('package.json must pin packageManager to pnpm@<version>')

  const candidates = [
    { command: 'pnpm', prefix: [] },
    { command: 'corepack', prefix: ['pnpm'] },
  ]
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, '--version'], {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    if (result.status === 0 && result.stdout.trim() === expected) {
      return { ...candidate, version: expected }
    }
  }
  throw new Error(
    `pnpm@${expected} is required. Enable Corepack or install the exact pinned version; the installer will not change global tools automatically.`
  )
}

async function runPnpm(root, profile, offline) {
  const resolved = await resolvePackageManager(root)
  const plan = buildInstallCommand(profile, offline)
  const result = spawnSync(
    resolved.command,
    [...resolved.prefix, ...plan.args],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`pnpm install failed with exit code ${result.status}`)
  return resolved.version
}

async function ensureEnvFile(root) {
  const envPath = join(root, '.env')
  try {
    await stat(envPath)
    return 'preserved'
  } catch {
    try {
      await copyFile(join(root, '.env.example'), envPath)
      return 'created from .env.example'
    } catch (error) {
      if (error.code === 'ENOENT') return 'not created: .env.example is absent'
      throw error
    }
  }
}

async function loadState(root) {
  try {
    return await readJson(join(root, STATE_PATH))
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function writeState(root, state) {
  const path = join(root, STATE_PATH)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0])
  return {
    ok: major >= MIN_NODE_MAJOR,
    current: process.versions.node,
    required: `>=${MIN_NODE_MAJOR}`,
  }
}

function checkGit(root) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf8',
  })
  return { ok: result.status === 0, available: result.status === 0 }
}

async function reportDoctor(root, profile) {
  const manifest = await readJson(join(root, 'package.json'))
  const node = checkNode()
  const git = checkGit(root)
  const packageManager = String(manifest.packageManager ?? 'not pinned')
  let pnpm = { ok: false, expected: packageManager, actual: 'not checked' }
  if (profile !== 'minimal') {
    try {
      const resolved = await resolvePackageManager(root)
      pnpm = { ok: true, expected: packageManager, actual: resolved.version }
    } catch (error) {
      pnpm = { ok: false, expected: packageManager, actual: error.message }
    }
  }
  const envExists = await stat(join(root, '.env')).then(() => true, () => false)
  return {
    command: 'doctor',
    profile,
    checks: { node, git, pnpm, env: { ok: envExists, status: envExists ? 'present' : 'missing (will be copied from template on install)' } },
    ok: node.ok && git.ok && pnpm.ok,
  }
}

async function verify(root) {
  const state = await loadState(root)
  const envExists = await stat(join(root, '.env')).then(() => true, () => false)
  const modulesExist = await stat(join(root, 'node_modules/.modules.yaml')).then(() => true, () => false)
  return {
    command: 'verify',
    ok: Boolean(state && envExists && modulesExist),
    state,
    checks: {
      installState: Boolean(state),
      env: envExists,
      pnpmModules: modulesExist,
    },
  }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function showHelp() {
  process.stdout.write([
    'MOONWITNESS developer setup',
    '',
    'Usage: node scripts/moonwitness.mjs <command> [options]',
    'Commands: install | doctor | repair | update | verify | uninstall',
    'Profiles: minimal | headquarter | arsy | full-dev',
    'Options: --profile <name> --offline --dry-run --root <path>',
    '',
    'install/repair/update use the pinned pnpm version and frozen lockfile.',
    'uninstall removes only the generated install-state marker; it never deletes .env or node_modules.',
  ].join('\n') + '\n')
}

export async function runCli(argv, cwd = process.cwd()) {
  const options = parseArgs(argv)
  const root = resolve(options.root ?? cwd)
  if (options.command === 'help') return showHelp()

  if (options.command === 'doctor') {
    const state = await loadState(root)
    const result = await reportDoctor(root, options.profile ?? state?.profile ?? 'full-dev')
    print(result)
    if (!result.ok) process.exitCode = 1
    return result
  }

  if (options.command === 'verify') {
    const result = await verify(root)
    print(result)
    if (!result.ok) process.exitCode = 1
    return result
  }

  if (options.command === 'uninstall') {
    const statePath = join(root, STATE_PATH)
    await rm(statePath, { force: true })
    await rm(join(root, '.moonwitness'), { recursive: false, force: true }).catch(() => {})
    print({
      command: 'uninstall',
      removed: 'generated .moonwitness/install-state.json',
      preserved: ['.env', 'node_modules', source files, Docker volumes, databases'],
    })
    return
  }

  if (!['install', 'repair', 'update'].includes(options.command)) {
    throw new Error(`Unknown command: ${options.command}`)
  }

  const previous = await loadState(root)
  const profile = options.profile ?? previous?.profile ?? 'full-dev'
  const plan = buildInstallCommand(profile, options.offline)
  if (options.dryRun) {
    print({ command: options.command, profile, plan, writes: ['.env if absent', STATE_PATH] })
    return
  }

  const node = checkNode()
  if (!node.ok) throw new Error(`Node.js ${node.required} is required; found ${node.current}`)
  const envStatus = await ensureEnvFile(root)
  const pnpmVersion = await runPnpm(root, profile, options.offline)
  await writeState(root, {
    schemaVersion: 1,
    profile,
    packageManager: `pnpm@${pnpmVersion}`,
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    installedAt: new Date().toISOString(),
    env: envStatus,
  })
  print({ command: options.command, profile, result: 'success', env: envStatus, packageManager: pnpmVersion })
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(`MOONWITNESS setup failed: ${error.message}`)
    process.exitCode = 1
  })
}
