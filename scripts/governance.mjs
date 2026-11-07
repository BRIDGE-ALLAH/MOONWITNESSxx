#!/usr/bin/env node
import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.yml',
  '.yaml',
])
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
])

async function exists(root, path) {
  try {
    await access(resolve(root, path))
    return true
  } catch {
    return false
  }
}

async function read(root, path) {
  try {
    return await readFile(resolve(root, path), 'utf8')
  } catch {
    return null
  }
}

async function directories(root, path) {
  try {
    const entries = await readdir(resolve(root, path), { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch {
    return []
  }
}

async function walk(root, path) {
  const result = []

  async function visit(current) {
    let entries
    try {
      entries = await readdir(resolve(root, current), { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = [current, entry.name].join('/')
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(child)
      } else {
        const extension = entry.name.slice(entry.name.lastIndexOf('.'))
        if (SOURCE_EXTENSIONS.has(extension)) result.push(child)
      }
    }
  }

  await visit(path)
  return result
}

function add(findings, severity, code, message, path = '') {
  findings.push({ severity, code, path, message })
}

function workspaceRoots(config) {
  const roots = []
  for (const line of config.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*['"]?([^'"#]+)['"]?\s*$/)
    if (match) roots.push(match[1].trim().replace(/\/$/, ''))
  }
  return roots
}

function packageDependencies(manifest) {
  return Object.assign(
    {},
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies
  )
}

function importedPackageNames(source) {
  const names = new Set()
  const patterns = [
    /\b(?:from|import)\s*['"](@[^/'"]+\/[^/'"]+)['"]/g,
    /\bimport\s*\(\s*['"](@[^/'"]+\/[^/'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"](@[^/'"]+\/[^/'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) names.add(match[1])
  }
  return [...names]
}

function ruleRows(markdown) {
  const matches = [...markdown.matchAll(/\*\*([A-Z]{2,4}-\d{2})\*\*/g)]
  return matches.map((match) => {
    const start = match.index
    const end = markdown.indexOf('\n- **', start + match[0].length)
    const block = markdown.slice(start, end < 0 ? markdown.length : end)
    return {
      id: match[1],
      hasEnforcement: /Enforcement:/i.test(block),
      hasState: /State:/i.test(block),
    }
  })
}

export async function analyzeGovernance(root = DEFAULT_ROOT) {
  const findings = []
  const packageMap = new Map()
  const workspacePackages = []
  const rootManifestText = await read(root, 'package.json')
  let rootManifest = null

  try {
    rootManifest = JSON.parse(rootManifestText ?? '')
  } catch {
    add(
      findings,
      'error',
      'GOV-ROOT-MANIFEST',
      'Root package.json is missing or invalid.',
      'package.json'
    )
  }

  if (rootManifest) {
    if (rootManifest.name !== 'moonwitness') {
      add(
        findings,
        'error',
        'GOV-ROOT-IDENTITY',
        'Root package name must be moonwitness.',
        'package.json'
      )
    }
    if (rootManifest.engines?.node !== '>=22') {
      add(findings, 'error', 'GOV-NODE-ENGINE', 'Node engine must be >=22.', 'package.json')
    }
    if (rootManifest.packageManager !== 'pnpm@12.16.1') {
      add(findings, 'error', 'GOV-PNPM-PIN', 'pnpm must remain pinned to 12.16.1.', 'package.json')
    }

    for (const command of ['governance:check', 'governance:doctor', 'governance:report']) {
      if (!rootManifest.scripts?.[command]) {
        add(findings, 'error', 'GOV-CLI-SCRIPT', `Missing root command ${command}.`, 'package.json')
      }
    }
  }

  const workspaceText = (await read(root, 'pnpm-workspace.yaml')) ?? ''
  const roots = workspaceRoots(workspaceText)
  if (!roots.includes('apps/*') || !roots.includes('packages/*')) {
    add(
      findings,
      'error',
      'GOV-WORKSPACE-ROOTS',
      'Workspace must include apps/* and packages/*.',
      'pnpm-workspace.yaml'
    )
  }
  if (roots.includes('services/*')) {
    add(
      findings,
      'error',
      'GOV-LEGACY-SERVICES',
      'services/* must remain excluded until ownership is reconciled.',
      'pnpm-workspace.yaml'
    )
  }

  for (const workspaceRoot of ['apps', 'packages']) {
    for (const name of await directories(root, workspaceRoot)) {
      const path = `${workspaceRoot}/${name}`
      const manifestText = await read(root, `${path}/package.json`)

      if (manifestText === null) {
        const children = await directories(root, path)
        if (children.length === 0) {
          add(
            findings,
            'warning',
            'GOV-EMPTY-WORKSPACE',
            `Directory ${path} has no manifest; verify it is planning-only.`,
            path
          )
        }
        continue
      }

      let manifest
      try {
        manifest = JSON.parse(manifestText)
      } catch {
        add(
          findings,
          'error',
          'GOV-PACKAGE-MANIFEST',
          `Invalid package manifest: ${path}/package.json`,
          path
        )
        continue
      }

      if (!manifest.name) {
        add(findings, 'error', 'GOV-PACKAGE-NAME', 'Workspace package must have a name.', path)
        continue
      }
      if (packageMap.has(manifest.name)) {
        add(
          findings,
          'error',
          'GOV-DUPLICATE-PACKAGE',
          `Duplicate package name ${manifest.name} also declared in ${
            packageMap.get(manifest.name).path
          }.`,
          path
        )
      } else {
        packageMap.set(manifest.name, { path, manifest })
      }

      workspacePackages.push({ path, manifest })
      if (manifest.private !== true) {
        add(
          findings,
          'warning',
          'GOV-PUBLISH-INTENT',
          'Workspace package should remain private until publishing is approved.',
          path
        )
      }

      const targets = []
      const collectTargets = (value) => {
        if (typeof value === 'string' && value.startsWith('./')) targets.push(value)
        else if (Array.isArray(value)) value.forEach(collectTargets)
        else if (value && typeof value === 'object') Object.values(value).forEach(collectTargets)
      }

      collectTargets(manifest.exports)
      collectTargets(manifest.main)
      collectTargets(manifest.module)
      collectTargets(manifest.types)

      for (const target of new Set(targets)) {
        if (!(await exists(root, `${path}/${target.slice(2)}`))) {
          add(
            findings,
            'warning',
            'GOV-ENTRYPOINT-MISSING',
            `Declared entrypoint does not exist: ${target}.`,
            path
          )
        }
      }
    }
  }

  for (const item of workspacePackages) {
    const isApp = item.path.startsWith('apps/')
    for (const [name, version] of Object.entries(packageDependencies(item.manifest))) {
      if (typeof version !== 'string' || !version.startsWith('workspace:')) continue
      const target = packageMap.get(name)

      if (!target) {
        add(
          findings,
          'error',
          'GOV-UNKNOWN-WORKSPACE-DEP',
          `Workspace dependency ${name} is not declared in apps/* or packages/*.`,
          item.path
        )
        continue
      }
      if (!isApp && target.path.startsWith('apps/')) {
        add(
          findings,
          'error',
          'GOV-PACKAGE-TO-APP',
          `Reusable package depends on application ${name}.`,
          item.path
        )
      }
      if (isApp && target.path.startsWith('apps/')) {
        add(
          findings,
          'error',
          'GOV-APP-TO-APP',
          `Application depends directly on application ${name}.`,
          item.path
        )
      }
      if (
        item.path === 'apps/headquarter' &&
        /(orm-db|postgres|sqlite|kysely|database-adapter)/i.test(name)
      ) {
        add(
          findings,
          'error',
          'GOV-HEADQUARTER-DB',
          `Headquarter must not depend directly on database implementation ${name}.`,
          item.path
        )
      }
      if (item.path === 'apps/arsy' && /(^|\/)(ui|headquarter)(\/|$)/i.test(name)) {
        add(
          findings,
          'error',
          'GOV-ARSY-UI',
          `ARSY must not depend on UI package ${name}.`,
          item.path
        )
      }
    }
  }

  const sourceFiles = []
  for (const workspaceRoot of ['apps', 'packages']) {
    sourceFiles.push(...(await walk(root, workspaceRoot)))
  }

  for (const path of sourceFiles) {
    const source = await read(root, path)
    if (source === null) continue
    const owner = path.split('/').slice(0, 2).join('/')

    for (const imported of importedPackageNames(source)) {
      const target = packageMap.get(imported)
      if (!target) continue
      if (owner.startsWith('packages/') && target.path.startsWith('apps/')) {
        add(
          findings,
          'error',
          'GOV-SOURCE-PACKAGE-TO-APP',
          `Package source imports application package ${imported}.`,
          path
        )
      }
      if (owner.startsWith('apps/') && target.path.startsWith('apps/') && owner !== target.path) {
        add(
          findings,
          'error',
          'GOV-SOURCE-APP-TO-APP',
          `Application source imports another application package ${imported}.`,
          path
        )
      }
      if (
        owner === 'apps/headquarter' &&
        /(orm-db|postgres|sqlite|kysely|database-adapter)/i.test(imported)
      ) {
        add(
          findings,
          'error',
          'GOV-SOURCE-HEADQUARTER-DB',
          `Headquarter source imports database implementation ${imported}.`,
          path
        )
      }
      if (owner === 'apps/arsy' && /(^|\/)(ui|headquarter)(\/|$)/i.test(imported)) {
        add(
          findings,
          'error',
          'GOV-SOURCE-ARSY-UI',
          `ARSY source imports UI package ${imported}.`,
          path
        )
      }
    }
  }

  if (!(await exists(root, 'governance/README.md'))) {
    add(
      findings,
      'error',
      'GOV-AUTHORITY-MISSING',
      'Canonical governance index is missing.',
      'governance/README.md'
    )
  }
  if (!(await exists(root, 'AGENTS.md'))) {
    add(findings, 'warning', 'GOV-AGENTS-MISSING', 'Root AGENTS.md is missing.', 'AGENTS.md')
  }

  const authority = (await read(root, 'governance/README.md')) ?? ''
  if (
    !/Approved security and safety constraints/i.test(authority) ||
    !/governance\\/contracts/i.test(authority)
  ) {
    add(
      findings,
      'error',
      'GOV-PRECEDENCE',
      'Governance index must define safety-first precedence and contract authority.',
      'governance/README.md'
    )
  }

  const enforcement = await read(root, 'governance/enforcement.md')
  let rows = []
  if (!enforcement) {
    add(
      findings,
      'error',
      'GOV-ENFORCEMENT-MISSING',
      'Rule enforcement register is missing.',
      'governance/enforcement.md'
    )
  } else {
    rows = ruleRows(enforcement)
    const ids = new Set()

    for (const row of rows) {
      if (ids.has(row.id)) {
        add(
          findings,
          'error',
          'GOV-DUPLICATE-RULE-ID',
          `Duplicate governance rule ID ${row.id}.`,
          'governance/enforcement.md'
        )
      }
      ids.add(row.id)
      if (!row.hasEnforcement || !row.hasState) {
        add(
          findings,
          'error',
          'GOV-RULE-INCOMPLETE',
          `Rule ${row.id} must declare enforcement and state.`,
          'governance/enforcement.md'
        )
      }
    }
    if (rows.length === 0) {
      add(
        findings,
        'error',
        'GOV-RULES-NOT-FOUND',
        'No rule IDs were found in the enforcement register.',
        'governance/enforcement.md'
      )
    }
  }

  const workflowFiles = await walk(root, '.github/workflows')
  for (const path of workflowFiles.filter(
    (file) => file.endsWith('.yml') || file.endsWith('.yaml')
  )) {
    const yaml = (await read(root, path)) ?? ''
    const hasPermissions = /^permissions\s*:/m.test(yaml) || /^\s{2,}permissions\s*:/m.test(yaml)

    if (!hasPermissions) {
      add(
        findings,
        'warning',
        'GOV-WORKFLOW-PERMISSIONS',
        'Workflow has no explicit workflow/job permissions block; review least privilege.',
        path
      )
    }
    if (/permissions\s*:\s*write-all/i.test(yaml)) {
      add(
        findings,
        'error',
        'GOV-WORKFLOW-WRITE-ALL',
        'Workflow must not grant write-all permissions.',
        path
      )
    }
    if (
      /pull_request_target:/m.test(yaml) &&
      /\\b(?:npm|pnpm|yarn)\\s+(?:install|run)|\\bnode\\s+.*scripts\\//i.test(yaml)
    ) {
      add(
        findings,
        'warning',
        'GOV-UNTRUSTED-PR-CODE',
        'pull_request_target workflow appears to execute code; verify untrusted PR isolation.',
        path
      )
    }
  }

  const counts = findings.reduce(
    (result, item) => {
      result[item.severity] += 1
      return result
    },
    { error: 0, warning: 0, info: 0 }
  )

  return {
    schemaVersion: 1,
    repository: 'BRIDGE-ALLAH/MOONWITNESS',
    generatedAt: new Date().toISOString(),
    result: counts.error > 0 ? 'failed' : counts.warning > 0 ? 'passed-with-warnings' : 'passed',
    counts,
    workspacePackages: workspacePackages.length,
    ruleCoverage: {
      total: rows.length,
      withEnforcement: rows.filter((row) => row.hasEnforcement).length,
      withState: rows.filter((row) => row.hasState).length,
      complete: rows.filter((row) => row.hasEnforcement && row.hasState).length,
    },
    findings: findings.sort(
      (a, b) =>
        a.severity.localeCompare(b.severity) ||
        a.code.localeCompare(b.code) ||
        a.path.localeCompare(b.path)
    ),
  }
}

export function formatFindings(report) {
  const lines = [
    '# MOONWITNESS Governance',
    '',
    `**Result:** ${report.result}`,
    `**Workspace packages:** ${report.workspacePackages}`,
    `**Errors:** ${report.counts.error} · **Warnings:** ${report.counts.warning}`,
    '',
  ]

  for (const severity of ['error', 'warning']) {
    lines.push(`## ${severity === 'error' ? 'Errors' : 'Warnings'}`, '')
    const matches = report.findings.filter((item) => item.severity === severity)
    if (matches.length === 0) lines.push('- None', '')
    else {
      for (const item of matches) {
        const location = item.path ? `${item.path}: ` : ''
        lines.push(`- [${item.code}] ${location}${item.message}`)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

function doctor(root) {
  const node = process.version
  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const pnpm = spawnSync(executable, ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf8',
  })

  return {
    node,
    nodeSupported: Number(node.slice(1).split('.')[0]) >= 22,
    pnpm: pnpm.status === 0 ? pnpm.stdout.trim() : null,
    pnpmSupported: pnpm.status === 0 && pnpm.stdout.trim() === '12.16.1',
    gitRepository: git.status === 0 ? git.stdout.trim() : null,
    root,
  }
}

export async function runGovernance({
  root = DEFAULT_ROOT,
  command = process.argv[2] ?? 'check',
  strict = process.argv.includes('--strict'),
} = {}) {
  if (command === 'doctor') {
    const result = doctor(root)
    console.log(JSON.stringify(result, null, 2))
    if (!result.nodeSupported || !result.pnpmSupported || !result.gitRepository) {
      process.exitCode = 1
    }
    return result
  }

  if (!['check', 'report'].includes(command)) {
    console.error('Usage: node scripts/governance.mjs <check|doctor|report> [--strict]')
    process.exitCode = 2
    return null
  }

  const report = await analyzeGovernance(root)
  if (command === 'report') console.log(JSON.stringify(report, null, 2))
  else console.log(formatFindings(report))

  if (report.counts.error > 0 || (strict && report.counts.warning > 0)) process.exitCode = 1
  return report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runGovernance()
}
