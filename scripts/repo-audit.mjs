import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

async function readText(path) {
  return readFile(resolve(root, path), 'utf8')
}

async function readJson(path) {
  return JSON.parse(await readText(path))
}

async function exists(path) {
  try {
    await access(resolve(root, path))
    return true
  } catch {
    return false
  }
}

function flattenExportTargets(value, output = []) {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => flattenExportTargets(item, output))
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => flattenExportTargets(item, output))
  }
  return output
}

export function getProjectLockfileDocument(lockfileContent) {
  const documents = lockfileContent
    .split(/^---\s*$/m)
    .map((document) => document.trim())
    .filter(Boolean)

  return documents.at(-1) ?? ''
}

export function findMissingWorkspaceImporters(lockfileContent, workspacePaths) {
  const projectLockfile = getProjectLockfileDocument(lockfileContent)
  const importerSection = projectLockfile.split(/\npackages:\s*\n/, 1)[0]
  const importerPaths = new Set(
    [...importerSection.matchAll(/^  ([^ \r\n][^:\r\n]*):(?:\s*\{\})?\s*$/gm)].map(
      (match) => match[1]
    )
  )

  return workspacePaths.filter((path) => !importerPaths.has(path))
}

export function containsBackgroundShelling(command) {
  return /(?:^|\s)&(?:\s|$)/.test(String(command))
}

export function getRequiredWorkspaceImporterPaths(workspacePackages) {
  const dependencySections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  return workspacePackages
    .filter(({ manifest }) =>
      dependencySections.some((section) => Object.keys(manifest[section] ?? {}).length > 0)
    )
    .map(({ path }) => path)
}

export function containsSuppressedFailure(command) {
  return /\|\|\s*(?:true|echo\b)|lint-skip/i.test(String(command))
}

export function parseWorkspaceGlobs(workspaceConfig) {
  const globs = workspaceConfig
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^['"]|['"]$/g, ''))

  return new Set(globs)
}

export async function runAudit({ writeReport = process.argv.includes('--write-report') } = {}) {
  const errors = []
  const warnings = []
  const notes = []
  const packageNames = new Map()
  const workspacePackages = []

  const rootPackage = await readJson('package.json')
  if (rootPackage.name !== 'moonwitness') {
    errors.push(`Root package name must be "moonwitness"; found "${rootPackage.name}".`)
  }
  if (rootPackage.packageManager !== 'pnpm@12.16.1') {
    errors.push(
      'packageManager must remain pinned to pnpm@12.16.1 until the lockfile is deliberately upgraded.'
    )
  }

  const requiredScripts = [
    'prepare',
    'check:repo',
    'audit:repo',
    'format:check',
    'format:check:all',
    'format',
    'test',
    'validate:repo',
    'validate',
    'lockfile:check',
    'lockfile:refresh',
  ]
  for (const name of requiredScripts) {
    if (!rootPackage.scripts?.[name]) errors.push(`Missing required root script: ${name}`)
  }

  for (const [name, command] of Object.entries(rootPackage.scripts ?? {})) {
    if (containsBackgroundShelling(command)) {
      errors.push(
        `Root script "${name}" uses uncontrolled shell backgrounding; use Turbo for parallel tasks.`
      )
    }
    if (containsSuppressedFailure(command)) {
      errors.push(`Root script "${name}" hides a failed check or contains a skip placeholder.`)
    }
  }

  for (const path of [
    'scripts/check-format.mjs',
    'scripts/check-staged.mjs',
    'scripts/check-commit-message.mjs',
    'scripts/install-hooks.mjs',
  ]) {
    if (!(await exists(path))) errors.push(`Missing required repository tooling script: ${path}`)
  }

  const formatCheckCommand = rootPackage.scripts?.['format:check'] ?? ''
  if (!String(formatCheckCommand).includes('scripts/check-format.mjs')) {
    errors.push('format:check must use the changed-files formatting gate.')
  }

  const workspaceConfig = await readText('pnpm-workspace.yaml')
  const workspaceGlobs = parseWorkspaceGlobs(workspaceConfig)
  if (!workspaceGlobs.has('apps/*') || !workspaceGlobs.has('packages/*')) {
    errors.push('pnpm-workspace.yaml must include apps/* and packages/*.')
  }
  if (workspaceGlobs.has('services/*')) {
    errors.push('services/* must not be a workspace until its ownership and runtime boundaries are reconciled.')
  }

  // Pass 1: collect every package manifest before resolving cross-package references.
  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(resolve(root, workspaceRoot), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const relativePath = `${workspaceRoot}/${entry.name}`
      const manifestPath = `${relativePath}/package.json`
      if (!(await exists(manifestPath))) {
        errors.push(`Workspace directory has no package.json: ${relativePath}`)
        continue
      }

      const manifest = await readJson(manifestPath)
      if (!manifest.name) {
        errors.push(`Package manifest is missing a name: ${manifestPath}`)
        continue
      }
      if (packageNames.has(manifest.name)) {
        errors.push(
          `Duplicate workspace package name "${manifest.name}" in ${packageNames.get(manifest.name)} and ${manifestPath}.`
        )
      } else {
        packageNames.set(manifest.name, manifestPath)
      }
      if (manifest.private !== true) {
        warnings.push(
          `Workspace package should remain private until publishing is explicitly designed: ${manifestPath}`
        )
      }
      workspacePackages.push({ path: relativePath, manifest, manifestPath })
    }
  }

  // Pass 2: validate package entrypoints, workspace dependencies, and script references.
  for (const item of workspacePackages) {
    const { path: packagePath, manifest, manifestPath } = item
    const targets = [
      manifest.main,
      manifest.module,
      manifest.types,
      ...flattenExportTargets(manifest.exports),
    ].filter((target) => typeof target === 'string' && target.length > 0)

    for (const target of new Set(targets)) {
      if (target.startsWith('node:') || target.startsWith('http:') || target.startsWith('https:'))
        continue
      const relativeTarget = target.startsWith('./') ? target.slice(2) : target
      if (relativeTarget.startsWith('../') || relativeTarget.startsWith('/')) continue
      const targetPath = `${packagePath}/${relativeTarget}`
      if (!(await exists(targetPath))) {
        warnings.push(
          `Declared package entrypoint does not exist: ${targetPath} (${manifest.name})`
        )
      }
    }

    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [dependency, specifier] of Object.entries(manifest[section] ?? {})) {
        if (String(specifier).startsWith('workspace:') && !packageNames.has(dependency)) {
          errors.push(
            `${manifestPath} declares ${dependency} as ${specifier}, but that workspace package does not exist.`
          )
        }
      }
    }

    for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
      const sourceCommand = String(command)
      const tsxTarget = sourceCommand.match(/\btsx\s+(?:watch\s+)?([^\s]+)/)?.[1]
      if (
        tsxTarget &&
        !tsxTarget.startsWith('-') &&
        !(await exists(`${packagePath}/${tsxTarget}`))
      ) {
        errors.push(
          `${manifest.name} script "${scriptName}" targets missing file ${packagePath}/${tsxTarget}.`
        )
      }

      const delegatedScripts = sourceCommand.matchAll(
        /--filter(?:=|\s+)(@[a-zA-Z0-9._/-]+)\s+run\s+([a-zA-Z0-9:_-]+)/g
      )
      for (const delegated of delegatedScripts) {
        const targetManifestPath = packageNames.get(delegated[1])
        if (!targetManifestPath) continue
        const targetManifest = await readJson(targetManifestPath)
        if (!targetManifest.scripts?.[delegated[2]]) {
          errors.push(
            `${manifest.name} script "${scriptName}" delegates to missing script "${delegated[2]}" in ${delegated[1]}.`
          )
        }
      }

      if (containsBackgroundShelling(command)) {
        errors.push(
          `${manifest.name} script "${scriptName}" uses uncontrolled shell backgrounding; use Turbo for parallel tasks.`
        )
      }
      if (containsSuppressedFailure(command)) {
        errors.push(
          `${manifest.name} script "${scriptName}" hides a failed check or contains a skip placeholder.`
        )
      }
      const matches = String(command).matchAll(/--filter(?:=|\s+)(@[a-zA-Z0-9._/-]+)/g)
      for (const match of matches) {
        if (!packageNames.has(match[1])) {
          errors.push(
            `${manifest.name} script "${scriptName}" targets unknown workspace package ${match[1]}.`
          )
        }
      }
    }
  }

  const lockfile = await readText('pnpm-lock.yaml')
  const missingImporters = findMissingWorkspaceImporters(
    lockfile,
    getRequiredWorkspaceImporterPaths(workspacePackages)
  )

  if (missingImporters.length > 0) {
    warnings.push(
      `pnpm-lock.yaml is missing workspace importer entries for: ${missingImporters.join(', ')}. Run "pnpm run lockfile:refresh" and commit the regenerated lockfile.`
    )
  }

  for (const path of [
    '.github/workflows/ci.yml',
    '.github/workflows/weekly-detection.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/refresh-lockfile.yml',
  ]) {
    if (!(await exists(path))) errors.push(`Missing required workflow: ${path}`)
  }

  const preCommit = await readText('.husky/pre-commit')
  for (const forbidden of [
    'generate-commit',
    'KILO_API_KEY',
    'CHANGELOG.md',
    'package.json',
    'curl ',
    'wget ',
  ]) {
    if (preCommit.includes(forbidden)) {
      errors.push(
        `pre-commit must not invoke network/AI or mutate release state; found "${forbidden}".`
      )
    }
  }

  const commitMessageHook = await readText('.husky/commit-msg')
  if (!commitMessageHook.includes('check-commit-message.mjs')) {
    errors.push('commit-msg hook must validate Conventional Commit syntax.')
  }

  const envExample = await readText('.env.example')
  if (!envExample.includes('GITHUB_REPO=MOONWITNESS')) {
    warnings.push('.env.example should use the canonical GITHUB_REPO=MOONWITNESS value.')
  }
  if (/GITHUB_TOKEN\s*=\s*[^\s#]+/.test(envExample) || /GH_TOKEN\s*=\s*[^\s#]+/.test(envExample)) {
    errors.push('.env.example must not contain a populated GitHub token.')
  }

  if (await exists('services')) {
    const serviceEntries = await readdir(resolve(root, 'services'), { withFileTypes: true })
    for (const entry of serviceEntries) {
      if (entry.isDirectory() && (await exists(`services/${entry.name}/package.json`))) {
        notes.push(
          `Legacy service excluded from pnpm workspace: services/${entry.name}. Migrate unique behavior before retirement.`
        )
      }
    }
  }

  const report = {
    repository: 'BRIDGE-ALLAH/MOONWITNESS',
    generatedAt: new Date().toISOString(),
    result: errors.length === 0 ? 'passed-with-warnings' : 'failed',
    counts: { errors: errors.length, warnings: warnings.length, notes: notes.length },
    errors,
    warnings,
    notes,
  }

  const lines = [
    '# MOONWITNESS repository audit',
    '',
    `**Result:** ${report.result}`,
    `**Generated:** ${report.generatedAt}`,
    '',
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    `- Notes: ${notes.length}`,
    '',
  ]
  for (const [heading, items] of [
    ['Errors', errors],
    ['Warnings', warnings],
    ['Notes', notes],
  ]) {
    lines.push(`## ${heading}`, '')
    if (items.length === 0) lines.push('- None', '')
    else {
      for (const item of items) lines.push(`- ${item}`)
      lines.push('')
    }
  }
  const markdown = lines.join('\n')

  if (writeReport) {
    const outputDirectory = resolve(root, '.artifacts')
    await mkdir(outputDirectory, { recursive: true })
    await writeFile(
      resolve(outputDirectory, 'repo-audit.json'),
      `${JSON.stringify(report, null, 2)}\n`
    )
    await writeFile(resolve(outputDirectory, 'repo-audit.md'), markdown)
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
  }

  console.log(markdown)
  if (errors.length > 0 || (process.argv.includes('--strict') && warnings.length > 0)) {
    process.exitCode = 1
  }
  return report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runAudit()
}
