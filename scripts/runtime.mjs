#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const EXPECTED_SERVICES = ['postgres', 'redis', 'arsy', 'headquarter']

export function extractEnvKeys(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter(Boolean)
}

export function parseComposePs(output) {
  const trimmed = output.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  }
}

export function assessChangeRisk({ blastRadius, reversibility, uncertainty }) {
  const dimensions = { blastRadius, reversibility, uncertainty }
  for (const [name, value] of Object.entries(dimensions)) {
    if (!Number.isInteger(value) || value < 0 || value > 3) {
      throw new Error(`${name} must be an integer from 0 to 3`)
    }
  }
  const score = blastRadius + reversibility + uncertainty
  return {
    score,
    dimensions,
    gate: score <= 2 ? 'automated-preflight-only' : score <= 5 ? 'human-approval' : 'blocked-until-reviewed',
  }
}

function command(name, args, cwd, options = {}) {
  return spawnSync(name, args, {
    cwd,
    encoding: 'utf8',
    timeout: options.timeout ?? 30_000,
    shell: process.platform === 'win32',
    maxBuffer: 8 * 1024 * 1024,
  })
}

function report(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function readEnvValue(content, key) {
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1] === key)
  return line
    ? line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
    : null
}

async function readEnv(root) {
  try {
    return await readFile(join(root, '.env'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

async function composeConfig(root) {
  const result = command('docker', ['compose', 'config', '--quiet'], root)
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'docker compose config validation failed')
  }
  const rendered = command('docker', ['compose', 'config'], root)
  if (rendered.error) throw rendered.error
  if (rendered.status !== 0) throw new Error(rendered.stderr.trim() || 'Unable to render Compose configuration')
  return createHash('sha256').update(rendered.stdout).digest('hex')
}

async function getHealth(root) {
  const result = command('docker', ['compose', 'ps', '--format', 'json'], root)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Unable to inspect Compose services')
  const containers = parseComposePs(result.stdout)
  const services = EXPECTED_SERVICES.map((service) => {
    const instances = containers.filter((item) => item.Service === service)
    const healthy = instances.length > 0 && instances.every((item) =>
      String(item.Health ?? '').toLowerCase() === 'healthy' &&
      String(item.State ?? '').toLowerCase() === 'running'
    )
    return { service, instances: instances.length, healthy }
  })
  return { services, ok: services.every((item) => item.healthy) }
}

async function runDoctor(root) {
  const docker = command('docker', ['--version'], root)
  const compose = command('docker', ['compose', 'version'], root)
  const engine = command('docker', ['info', '--format', '{{.ServerVersion}}'], root)
  const checks = {
    dockerCli: { ok: docker.status === 0, detail: docker.stdout.trim() || docker.stderr.trim() },
    compose: { ok: compose.status === 0, detail: compose.stdout.trim() || compose.stderr.trim() },
    engine: { ok: engine.status === 0, detail: engine.stdout.trim() || engine.stderr.trim() },
  }
  return { command: 'doctor', checks, ok: Object.values(checks).every((item) => item.ok) }
}

async function runPreflight(root) {
  const env = await readEnv(root)
  const keys = extractEnvKeys(env)
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const mode = process.env.NODE_ENV ?? readEnvValue(env, 'NODE_ENV') ?? 'development'
  const result = {
    command: 'preflight',
    mode,
    packageManager: manifest.packageManager,
    envFile: Boolean(env),
    envKeys: keys,
    composeConfig: null,
    warnings: [],
    ok: true,
  }
  if (mode === 'production') {
    result.ok = false
    result.warnings.push('The checked-in Compose stack is development-oriented; production deployment is not supported by this preflight.')
  }
  if (!env) result.warnings.push('.env is absent; create it from .env.docker and set local values before starting Compose.')
  if (!keys.includes('POSTGRES_PASSWORD') || /POSTGRES_PASSWORD\s*=\s*postgres(?:\s|$)/m.test(env)) {
    result.warnings.push('PostgreSQL password is unset or uses the local default. Do not expose this stack to an untrusted network.')
  }
  try {
    result.composeConfig = await composeConfig(root)
  } catch (error) {
    result.ok = false
    result.warnings.push(error.message)
  }
  return result
}

async function createPassport(root) {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const lockfile = await readFile(join(root, 'pnpm-lock.yaml'))
  const env = await readEnv(root)
  const commit = command('git', ['rev-parse', 'HEAD'], root)
  const status = command('git', ['status', '--porcelain'], root)
  let composeDigest = null
  try {
    composeDigest = await composeConfig(root)
  } catch {
    // A passport remains useful without Docker; no resolved config or secrets are persisted.
  }
  let health = null
  try {
    health = await getHealth(root)
  } catch {
    // Service state is optional when Docker is not installed or running.
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: {
      packageName: manifest.name,
      commit: commit.status === 0 ? commit.stdout.trim() : null,
      dirty: status.status === 0 ? Boolean(status.stdout.trim()) : null,
    },
    toolchain: {
      node: process.versions.node,
      packageManager: manifest.packageManager ?? null,
      platform: process.platform,
      architecture: process.arch,
    },
    integrity: {
      lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
      composeConfigSha256: composeDigest,
    },
    environment: {
      filePresent: Boolean(env),
      variableNames: extractEnvKeys(env),
      valuesIncluded: false,
    },
    services: health,
  }
}

async function main(argv) {
  const [action = 'help', ...args] = argv
  const root = resolve(process.cwd())
  if (action === 'help' || args.includes('--help')) {
    process.stdout.write('Usage: node scripts/runtime.mjs <doctor|preflight|health|passport> [--write]\n')
    return
  }
  if (action === 'doctor') {
    const result = await runDoctor(root)
    report(result)
    if (!result.ok) process.exitCode = 1
    return
  }
  if (action === 'preflight') {
    const result = await runPreflight(root)
    report(result)
    if (!result.ok) process.exitCode = 1
    return
  }
  if (action === 'health') {
    const result = await getHealth(root)
    report({ command: 'health', ...result })
    if (!result.ok) process.exitCode = 1
    return
  }
  if (action === 'passport') {
    const result = await createPassport(root)
    if (args.includes('--write')) {
      const output = join(root, '.artifacts', 'runtime-passport.json')
      await mkdir(join(root, '.artifacts'), { recursive: true })
      await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
      report({ command: 'passport', written: '.artifacts/runtime-passport.json', secretValuesIncluded: false })
    } else {
      report(result)
    }
    return
  }
  throw new Error(`Unknown runtime action: ${action}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Runtime check failed: ${error.message}`)
    process.exitCode = 1
  })
}
