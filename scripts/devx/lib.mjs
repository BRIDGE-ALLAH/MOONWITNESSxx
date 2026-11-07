import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const WORKSPACE_ROOTS = ['apps', 'packages']
const SAFE_CONTEXT_FILES = [
  'AGENTS.md',
  '.copilot-instructions.md',
  'README.md',
  'CONTRIBUTING.md',
  'docs/24-repository-and-automation-governance.md',
  'pnpm-workspace.yaml',
  'turbo.json',
]

async function readJson(path, root) {
  return JSON.parse(await readFile(join(root, path), 'utf8'))
}

async function exists(path, root) {
  try {
    await readFile(join(root, path))
    return true
  } catch {
    return false
  }
}

export async function loadWorkspacePackages(root) {
  const packages = []
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    let entries = []
    try {
      entries = await readdir(join(root, workspaceRoot), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const path = join(workspaceRoot, entry.name)
      try {
        const manifest = await readJson(join(path, 'package.json'), root)
        if (manifest.name) packages.push({ name: manifest.name, path: path.replaceAll('\\\\', '/'), manifest })
      } catch {
        // Non-package directories are not workspace packages.
      }
    }
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name))
}

export function parseMajorVersion(version) {
  const match = String(version).match(/(?:^|v)(\\d+)(?:\\.|$)/)
  return match ? Number(match[1]) : null
}

export async function runDoctor({ root, nodeVersion = process.version, pnpmVersion = null }) {
  const findings = []
  const rootManifest = await readJson('package.json', root)
  const workspacePackages = await loadWorkspacePackages(root)
  const workspaceText = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8').catch(() => '')

  const nodeMajor = parseMajorVersion(nodeVersion)
  findings.push({
    id: 'node-version',
    status: nodeMajor !== null && nodeMajor >= 22 ? 'pass' : 'fail',
    message: nodeMajor !== null && nodeMajor >= 22 ? `Node.js ${nodeVersion} meets the Node 22+ baseline.` : `Node.js ${nodeVersion} is unsupported; use Node.js 22 or newer.`,
    fix: 'Install the Node version declared by the repository toolchain policy.',
  })

  const expectedPnpm = String(rootManifest.packageManager ?? '').match(/^pnpm@(.+)$/)?.[1] ?? null
  if (!expectedPnpm) {
    findings.push({ id: 'package-manager-pin', status: 'fail', message: 'Root package.json does not pin pnpm.', fix: 'Set packageManager to the repository-approved pnpm version.' })
  } else if (pnpmVersion === null) {
    findings.push({ id: 'pnpm-installed', status: 'warn', message: `pnpm@${expectedPnpm} is required but the executable version could not be read.`, fix: 'Enable Corepack or install the pinned pnpm version.' })
  } else {
    const actual = String(pnpmVersion).trim().replace(/^v/, '')
    findings.push({
      id: 'pnpm-version',
      status: actual === expectedPnpm ? 'pass' : 'fail',
      message: actual === expectedPnpm ? `pnpm ${actual} matches the pinned version.` : `pnpm ${actual} does not match pinned pnpm ${expectedPnpm}.`,
      fix: `Run corepack prepare pnpm@${expectedPnpm} --activate.`,
    })
  }

  for (const required of ['apps/*', 'packages/*']) {
    findings.push({
      id: `workspace-${required.replace(/[^a-z]+/gi, '-')}`,
      status: workspaceText.includes(required) ? 'pass' : 'fail',
      message: workspaceText.includes(required) ? `Workspace includes ${required}.` : `Workspace is missing ${required}.`,
      fix: 'Restore the canonical workspace globs in pnpm-workspace.yaml.',
    })
  }

  findings.push({
    id: 'lockfile',
    status: await exists('pnpm-lock.yaml', root) ? 'pass' : 'fail',
    message: await exists('pnpm-lock.yaml', root) ? 'pnpm-lock.yaml exists.' : 'pnpm-lock.yaml is missing.',
    fix: 'Run pnpm run lockfile:refresh and review the resulting diff.',
  })
  findings.push({
    id: 'env-example',
    status: await exists('.env.example', root) ? 'pass' : 'warn',
    message: await exists('.env.example', root) ? 'Safe environment template exists.' : 'No .env.example was found.',
    fix: 'Document required non-secret environment variable names in .env.example.',
  })
  findings.push({
    id: 'dependencies-installed',
    status: await exists('node_modules', root) ? 'pass' : 'warn',
    message: await exists('node_modules', root) ? 'Root node_modules directory exists.' : 'Dependencies do not appear to be installed.',
    fix: 'Run pnpm install --frozen-lockfile after resolving any lockfile drift.',
  })

  for (const pkg of workspacePackages) {
    const hasScripts = Object.keys(pkg.manifest.scripts ?? {}).length > 0
    findings.push({
      id: `package-${pkg.name}`,
      status: hasScripts ? 'pass' : 'warn',
      message: hasScripts ? `${pkg.name} exposes package scripts.` : `${pkg.name} has no package scripts.`,
      fix: `Inspect ${pkg.path}/package.json and add only real, testable commands owned by this package.`,
    })
  }

  const counts = Object.fromEntries(['pass', 'warn', 'fail'].map((status) => [status, findings.filter((item) => item.status === status).length]))
  return { ok: counts.fail === 0, counts, nodeVersion, pnpmVersion, expectedPnpm, packageCount: workspacePackages.length, findings }
}

function workspaceDependencies(manifest) {
  const names = []
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (String(version).startsWith('workspace:')) names.push(name)
    }
  }
  return names
}

export async function createChangePlan({ root, changedFiles }) {
  const packages = await loadWorkspacePackages(root)
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const direct = new Set()
  const reasons = new Map()
  const rootWide = changedFiles.some((file) => !WORKSPACE_ROOTS.some((prefix) => file.startsWith(prefix + '/')))

  if (rootWide) {
    for (const pkg of packages) {
      direct.add(pkg.name)
      reasons.set(pkg.name, ['root-level tooling/configuration changed'])
    }
  } else {
    for (const file of changedFiles) {
      const pkg = packages.find((candidate) => file === candidate.path || file.startsWith(candidate.path + '/'))
      if (pkg) {
        direct.add(pkg.name)
        const current = reasons.get(pkg.name) ?? []
        current.push(file)
        reasons.set(pkg.name, current)
      }
    }
  }

  const impacted = new Set(direct)
  let changed = true
  while (changed) {
    changed = false
    for (const pkg of packages) {
      if (impacted.has(pkg.name)) continue
      const dependencies = workspaceDependencies(pkg.manifest)
      const affectedDependencies = dependencies.filter((name) => impacted.has(name))
      if (affectedDependencies.length) {
        impacted.add(pkg.name)
        reasons.set(pkg.name, affectedDependencies.map((name) => `depends on changed package ${name}`))
        changed = true
      }
    }
  }

  const tasks = []
  for (const pkg of packages.filter((item) => impacted.has(item.name))) {
    const scripts = pkg.manifest.scripts ?? {}
    const selected = ['test', 'test:governance', 'type-check', 'build'].filter((name) => scripts[name])
    for (const script of selected) {
      tasks.push({
        id: `${pkg.name}:${script}`,
        package: pkg.name,
        script,
        command: `pnpm --filter ${pkg.name} run ${script}`,
        reason: reasons.get(pkg.name) ?? [],
      })
    }
  }

  return {
    changedFiles: [...new Set(changedFiles)].sort(),
    directPackages: [...direct].sort(),
    impactedPackages: [...impacted].sort(),
    tasks,
    notes: changedFiles.length ? [] : ['No changed files were detected. Pass --base <ref> or stage/modify files before planning.'],
  }
}

function redact(text) {
  return text
    .split(/\\r?\\n/)
    .filter((line) => !/(?:api[_-]?key|access[_-]?token|secret|password|private[_-]?key)\\s*[:=]/i.test(line))
    .join('\\n')
}

export async function compileRepoContext({ root, maxChars = 12000, format = 'markdown' }) {
  const packages = await loadWorkspacePackages(root)
  const sections = []
  for (const path of SAFE_CONTEXT_FILES) {
    try {
      const content = redact(await readFile(join(root, path), 'utf8'))
      sections.push({ path, content })
    } catch {
      // Optional context files are omitted when absent.
    }
  }
  const packageSummary = packages.map(({ name, path, manifest }) => ({
    name,
    path,
    scripts: Object.keys(manifest.scripts ?? {}).sort(),
    workspaceDependencies: workspaceDependencies(manifest).sort(),
  }))
  const payload = {
    schemaVersion: 1,
    generatedBy: 'moonwitness-devx',
    packageCount: packages.length,
    packages: packageSummary,
    sections,
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const document = { ...payload, fingerprint }
  const rendered = format === 'json'
    ? JSON.stringify(document, null, 2)
    : [
        '# MOONWITNESS Repository Context',
        '',
        `Context fingerprint: \`${fingerprint}\``,
        '',
        '## Workspace package map',
        ...packageSummary.map((pkg) => `- **${pkg.name}** — \`${pkg.path}\`; scripts: ${pkg.scripts.join(', ') || 'none'}; workspace deps: ${pkg.workspaceDependencies.join(', ') || 'none'}`),
        '',
        ...sections.flatMap((section) => [`## Source: ${section.path}`, '', section.content, '']),
      ].join('\\n')
  if (rendered.length <= maxChars) return { fingerprint, truncated: false, content: rendered }
  const suffix = `\\n\\n[Context truncated at ${maxChars} characters. Fingerprint covers the complete source context.]`
  return { fingerprint, truncated: true, content: rendered.slice(0, Math.max(0, maxChars - suffix.length)) + suffix }
}
