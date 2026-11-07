import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const WORKSPACE_ROOTS = ['apps', 'packages']
const WORKSPACE_PATTERNS = new Set(WORKSPACE_ROOTS.map((root) => root + '/*'))

const readText = async (path, fallback = '') => {
  try { return await readFile(path, 'utf8') } catch { return fallback }
}
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const finding = (id, severity, message) => ({ id, severity, message })

async function workspacePackages(root, patterns) {
  const packages = []
  // Never use a workspace glob from repository content as a filesystem path.
  // Only the two repository-owned workspace roots are traversed.
  for (const base of WORKSPACE_ROOTS) {
    if (!patterns.includes(base + '/*')) continue
    const directory = join(root, base)
    let entries = []
    try { entries = await readdir(directory, { withFileTypes: true }) } catch { continue }
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const packageDirectory = join(directory, entry.name)
      try {
        const manifest = await readJson(join(packageDirectory, 'package.json'))
        packages.push({ directory: packageDirectory, path: relative(root, packageDirectory).replaceAll('\\\\', '/'), manifest })
      } catch { /* directories without package manifests are not workspace packages */ }
    }
  }
  return packages
}

export async function auditWorkspaceContracts({ root } = {}) {
  if (!root) throw new Error('root is required')
  const findings = []
  const workspaceText = await readText(join(root, 'pnpm-workspace.yaml'))
  const patterns = [...workspaceText.matchAll(/^\s*-\s*["']([^"']+)["']/gm)].map((match) => match[1])
  if (!patterns.length) findings.push(finding('workspace-patterns-missing', 'error', 'pnpm-workspace.yaml declares no package globs.'))
  for (const pattern of patterns) {
    if (!WORKSPACE_PATTERNS.has(pattern)) {
      const id = pattern === 'services/*' ? 'legacy-services-in-workspace' : 'unsupported-workspace-pattern'
      findings.push(finding(id, 'error', 'Workspace pattern is not an approved repository root: ' + pattern))
    }
  }

  const packages = await workspacePackages(root, patterns)
  const byName = new Map()
  for (const item of packages) {
    if (!item.manifest.name) {
      findings.push(finding('package-name-missing', 'error', item.path + ' has no package name.'))
      continue
    }
    const previous = byName.get(item.manifest.name)
    if (previous) findings.push(finding('duplicate-package-name', 'error', item.manifest.name + ' is declared by both ' + previous + ' and ' + item.path + '.'))
    else byName.set(item.manifest.name, item.path)
  }

  for (const item of packages) {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dependency, specifier] of Object.entries(item.manifest[section] ?? {})) {
        if (typeof specifier === 'string' && specifier.startsWith('workspace:') && !byName.has(dependency)) {
          findings.push(finding('unresolved-workspace-dependency', 'error', item.path + ' references missing workspace package ' + dependency + '.'))
        }
      }
    }
    for (const [script, command] of Object.entries(item.manifest.scripts ?? {})) {
      if (typeof command === 'string' && /\b(?:echo|printf)\s+.*\b(?:skip|placeholder|todo)\b/i.test(command)) {
        findings.push(finding('success-masking-script', 'error', item.path + ' script "' + script + '" is a placeholder and must not report success.'))
      }
    }
  }

  const arsy = packages.find((item) => item.path === 'apps/arsy')
  if (arsy) {
    if (arsy.manifest.dependencies?.['@riotworks/ui']) findings.push(finding('backend-ui-dependency', 'error', 'apps/arsy must not depend on the Headquarter UI package.'))
    if (String(arsy.manifest.scripts?.build ?? '').includes('@riotworks/arsy-core')) findings.push(finding('app-build-owned-by-core', 'error', 'apps/arsy build delegates to arsy-core; the HTTP application must own its build.'))
    if (String(arsy.manifest.scripts?.start ?? '').includes('@riotworks/arsy-core')) findings.push(finding('app-start-owned-by-core', 'error', 'apps/arsy start delegates to arsy-core; the HTTP application must own its runtime.'))
  }

  const core = packages.find((item) => item.path === 'packages/arsy-core')
  if (core && ['build', 'start', 'dev'].some((script) => core.manifest.scripts?.[script])) {
    findings.push(finding('core-owns-http-lifecycle', 'error', 'packages/arsy-core is framework-neutral and must not own app build/start/dev scripts.'))
  }

  return { ok: !findings.some((item) => item.severity === 'error'), packageCount: packages.length, packages: packages.map((item) => ({ name: item.manifest.name, path: item.path })), findings }
}

async function pageRoutes(directory, segments = []) {
  let entries = []
  try { entries = await readdir(directory, { withFileTypes: true }) } catch { return [] }
  const routes = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const next = entry.name.startsWith('(') && entry.name.endsWith(')') ? segments : [...segments, entry.name]
      routes.push(...await pageRoutes(join(directory, entry.name), next))
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      routes.push(segments.length ? '/' + segments.join('/') : '/')
    }
  }
  return routes
}

export async function auditHeadquarterExperience({ root } = {}) {
  if (!root) throw new Error('root is required')
  const findings = []
  const routes = await pageRoutes(join(root, 'apps/headquarter/src/app'))
  const navigation = await readText(join(root, 'apps/headquarter/src/shell/navigation.ts'))
  const topbar = await readText(join(root, 'apps/headquarter/src/shell/topbar.tsx'))
  const entries = [...navigation.matchAll(/\{\s*href:\s*'([^']+)'[^}]*label:\s*'([^']+)'[^}]*status:\s*'([^']+)'[^}]*\}/g)]
    .map((match) => ({ href: match[1], label: match[2], status: match[3] }))

  if (!entries.length) findings.push(finding('navigation-registry-empty', 'error', 'No navigable routes were parsed from the Headquarter navigation registry.'))
  const seen = new Set()
  for (const item of entries) {
    if (seen.has(item.href)) findings.push(finding('duplicate-navigation-route', 'error', 'Navigation route is declared more than once: ' + item.href))
    seen.add(item.href)
    if (!routes.includes(item.href)) findings.push(finding('navigation-route-missing', 'error', item.label + ' points to ' + item.href + ' but no page.tsx route exists.'))
    if (item.status !== 'prototype') findings.push(finding('route-status-ambiguous', 'error', item.label + ' must be explicitly marked prototype until live data is connected.'))
  }
  for (const route of routes.filter((item) => item !== '/')) {
    if (!seen.has(route)) findings.push(finding('route-not-discoverable', 'warning', route + ' exists but is not listed in Headquarter navigation.'))
  }
  if (!topbar.includes('labels.demo') || !topbar.includes('aria-label={labels.demo}') || !topbar.includes('role="status"')) {
    findings.push(finding('persistent-demo-disclosure-missing', 'error', 'The topbar must expose an accessible demo-data disclosure on every route and viewport.'))
  }
  return { ok: !findings.some((item) => item.severity === 'error'), routeCount: routes.length, navigableCount: entries.length, routes, findings }
}

export async function auditReleaseReadiness({ root } = {}) {
  if (!root) throw new Error('root is required')
  const findings = []
  let manifest = {}
  try { manifest = await readJson(join(root, 'package.json')) } catch { findings.push(finding('root-manifest-missing', 'error', 'Root package.json is missing or invalid.')) }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version ?? '')) findings.push(finding('root-version-invalid', 'error', 'Root package version is not valid SemVer.'))

  const changelog = await readText(join(root, 'CHANGELOG.md'))
  const unreleased = changelog.match(/^## \[Unreleased\]\s*([\s\S]*?)(?=^## \[|$)/m)
  if (!unreleased || !unreleased[1].trim()) findings.push(finding('unreleased-changelog-empty', 'error', 'CHANGELOG.md must contain a non-empty Unreleased section before release.'))

  let workflowFiles = []
  try { workflowFiles = await readdir(join(root, '.github/workflows')) } catch { /* reported below */ }
  if (!workflowFiles.some((file) => /release/i.test(file))) findings.push(finding('release-workflow-missing', 'error', 'No GitHub Release workflow is present; release publication is not automated or verified.'))
  if (!workflowFiles.some((file) => /(deploy|production)/i.test(file))) findings.push(finding('production-deployment-workflow-missing', 'error', 'No production deployment workflow is present.'))

  const arsyDocker = await readText(join(root, 'Dockerfile.arsy'))
  const hqDocker = await readText(join(root, 'Dockerfile.headquarter'))
  if (!/CMD\s+\[\s*"pnpm"\s*,\s*"start"\s*\]/.test(arsyDocker)) findings.push(finding('arsy-production-entrypoint-invalid', 'error', 'Dockerfile.arsy must start the production application entrypoint, not a development server.'))
  if (!/CMD\s+\[\s*"pnpm"\s*,\s*"start"\s*\]/.test(hqDocker)) findings.push(finding('headquarter-production-entrypoint-invalid', 'error', 'Dockerfile.headquarter must start the production application entrypoint.'))
  const compose = await readText(join(root, 'docker-compose.yml'))
  if ((compose.match(/healthcheck:/g) ?? []).length < 2) findings.push(finding('compose-healthchecks-missing', 'error', 'Both ARSY and Headquarter need health checks in the local compose stack.'))
  if (/POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:-postgres\}/.test(compose)) findings.push(finding('weak-compose-default-credential', 'warning', 'Compose has a development-only default database password; never use it in production.'))

  return {
    ready: !findings.some((item) => item.severity === 'error'),
    packageVersion: manifest.version ?? null,
    latestChangelogVersion: (changelog.match(/^## \[([^\]]+)\]/m) ?? [])[1] ?? null,
    workflowFiles,
    findings,
    note: 'This local preflight cannot verify remote tags, GitHub Release publication, secrets, deployment-provider state, live health, or production smoke tests.',
  }
}

export async function runProductAudit({ root } = {}) {
  const [workspace, experience, release] = await Promise.all([
    auditWorkspaceContracts({ root }),
    auditHeadquarterExperience({ root }),
    auditReleaseReadiness({ root }),
  ])
  return { ok: workspace.ok && experience.ok, readyForRelease: workspace.ok && experience.ok && release.ready, workspace, experience, release }
}
