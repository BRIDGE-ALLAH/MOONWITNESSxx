import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function runAudit({ writeReport = process.argv.includes('--write-report') } = {}) {
  const errors = []
  const warnings = []
  const notes = []
  const packageNames = new Map()
  const workspacePackages = []
  const declaredPackageNames = new Set()

  // Pre-index package names so dependency checks are independent of directory order.
  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(resolve(root, workspaceRoot), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = `${workspaceRoot}/${entry.name}/package.json`
      if (await exists(manifestPath)) {
        const manifest = await readJson(manifestPath)
        if (manifest.name) declaredPackageNames.add(manifest.name)
      }
    }
  }

  const rootPackage = await readJson('package.json')
  if (rootPackage.name !== 'moonwitness') {
    errors.push(`Root package name must be "moonwitness"; found "${rootPackage.name}".`)
  }
  if (rootPackage.engines?.node !== '>=22') {
    errors.push('Node.js engine must remain >=22 to match the supported local baseline.')
  }
  if (rootPackage.packageManager !== 'pnpm@12.16.1') {
    errors.push(
      'packageManager must remain pinned to pnpm@12.16.1 until the lockfile is deliberately upgraded.'
    )
  }

  const requiredScripts = [
    'check:repo',
    'audit:repo',
    'format:check',
    'test',
    'validate:repo',
    'validate',
    'lockfile:check',
    'lockfile:refresh',
    'format',
    'lint',
    'type-check',
  ]
  for (const name of requiredScripts) {
    if (!rootPackage.scripts?.[name]) errors.push(`Missing required root script: ${name}`)
  }

  const workspaceConfig = await readText('pnpm-workspace.yaml')
  if (!/^\s*-\s*["']apps\/\*["']\s*$/m.test(workspaceConfig) || !/^\s*-\s*["']packages\/\*["']\s*$/m.test(workspaceConfig)) {
    errors.push('pnpm-workspace.yaml must include apps/* and packages/*.')
  }
  if (workspaceConfig.includes('"services/*"')) {
    errors.push(
      'services/* must not be a workspace until its ownership and runtime boundaries are reconciled.'
    )
  }

  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(resolve(root, workspaceRoot), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const relativePath = [workspaceRoot, entry.name].join('/')
      const manifestPath = `${relativePath}/package.json`
      if (!(await exists(manifestPath))) {
        const entries = await readdir(resolve(root, relativePath))
        if (entries.every((name) => ['todo.md', 'README.md'].includes(name))) {
          notes.push(
            `Planning-only folder is not a workspace package until it has a manifest: ${relativePath}.`
          )
          continue
        }
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
      workspacePackages.push({ path: relativePath, manifest })

      const targets = [
        manifest.main,
        manifest.module,
        manifest.types,
        ...flattenExportTargets(manifest.exports),
      ].filter((target) => typeof target === 'string' && target.startsWith('./'))

      for (const target of new Set(targets)) {
        const targetPath = `${relativePath}/${target.slice(2)}`
        if (!(await exists(targetPath))) {
          warnings.push(
            `Declared package entrypoint does not exist: ${targetPath} (${manifest.name})`
          )
        }
      }

      for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
        const matches = String(command).matchAll(/--filter\s+(@[a-zA-Z0-9._/-]+)/g)
        for (const match of matches) {
          if (!declaredPackageNames.has(match[1])) {
            warnings.push(
              `${manifest.name} script "${scriptName}" targets unknown workspace package ${match[1]}.`
            )
          }
        }
      }
    }
  }

  const lockfile = await readText('pnpm-lock.yaml')
  // pnpm 12 may include a package-manager lock document before the workspace lock document.
  // Use the final top-level packages section so importer checks inspect the workspace document.
  const packageSectionIndex = lockfile.lastIndexOf('\npackages:\n')
  const importerSection = packageSectionIndex >= 0 ? lockfile.slice(0, packageSectionIndex) : lockfile
  const missingImporters = workspacePackages
    .map((item) => item.path.split(sep).join('/'))
    .filter((path) => !new RegExp(`^  ${escapeRegExp(path)}:\\s*import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function runAudit({ writeReport = process.argv.includes('--write-report') } = {}) {
  const errors = []
  const warnings = []
  const notes = []
  const packageNames = new Map()
  const workspacePackages = []
  const declaredPackageNames = new Set()

  // Pre-index package names so dependency checks are independent of directory order.
  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(resolve(root, workspaceRoot), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const manifestPath = `${workspaceRoot}/${entry.name}/package.json`
      if (await exists(manifestPath)) {
        const manifest = await readJson(manifestPath)
        if (manifest.name) declaredPackageNames.add(manifest.name)
      }
    }
  }

  const rootPackage = await readJson('package.json')
  if (rootPackage.name !== 'moonwitness') {
    errors.push(`Root package name must be "moonwitness"; found "${rootPackage.name}".`)
  }
  if (rootPackage.engines?.node !== '>=22') {
    errors.push('Node.js engine must remain >=22 to match the supported local baseline.')
  }
  if (rootPackage.packageManager !== 'pnpm@12.16.1') {
    errors.push(
      'packageManager must remain pinned to pnpm@12.16.1 until the lockfile is deliberately upgraded.'
    )
  }

  const requiredScripts = [
    'check:repo',
    'audit:repo',
    'format:check',
    'test',
    'validate:repo',
    'validate',
    'lockfile:check',
    'lockfile:refresh',
    'format',
    'lint',
    'type-check',
  ]
  for (const name of requiredScripts) {
    if (!rootPackage.scripts?.[name]) errors.push(`Missing required root script: ${name}`)
  }

  const workspaceConfig = await readText('pnpm-workspace.yaml')
  if (!/^\s*-\s*["']apps\/\*["']\s*$/m.test(workspaceConfig) || !/^\s*-\s*["']packages\/\*["']\s*$/m.test(workspaceConfig)) {
    errors.push('pnpm-workspace.yaml must include apps/* and packages/*.')
  }
  if (workspaceConfig.includes('"services/*"')) {
    errors.push(
      'services/* must not be a workspace until its ownership and runtime boundaries are reconciled.'
    )
  }

  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(resolve(root, workspaceRoot), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const relativePath = [workspaceRoot, entry.name].join('/')
      const manifestPath = `${relativePath}/package.json`
      if (!(await exists(manifestPath))) {
        const entries = await readdir(resolve(root, relativePath))
        if (entries.every((name) => ['todo.md', 'README.md'].includes(name))) {
          notes.push(
            `Planning-only folder is not a workspace package until it has a manifest: ${relativePath}.`
          )
          continue
        }
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
      workspacePackages.push({ path: relativePath, manifest })

      const targets = [
        manifest.main,
        manifest.module,
        manifest.types,
        ...flattenExportTargets(manifest.exports),
      ].filter((target) => typeof target === 'string' && target.startsWith('./'))

      for (const target of new Set(targets)) {
        const targetPath = `${relativePath}/${target.slice(2)}`
        if (!(await exists(targetPath))) {
          warnings.push(
            `Declared package entrypoint does not exist: ${targetPath} (${manifest.name})`
          )
        }
      }

      for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
        const matches = String(command).matchAll(/--filter\s+(@[a-zA-Z0-9._/-]+)/g)
        for (const match of matches) {
          if (!declaredPackageNames.has(match[1])) {
            warnings.push(
              `${manifest.name} script "${scriptName}" targets unknown workspace package ${match[1]}.`
            )
          }
        }
      }
    }
  }

  const lockfile = await readText('pnpm-lock.yaml')
  // pnpm 12 may include a package-manager lock document before the workspace lock document.
  // Use the final top-level packages section so importer checks inspect the workspace document.
  const packageSectionIndex = lockfile.lastIndexOf('\npackages:\n')
  const importerSection = packageSectionIndex >= 0 ? lockfile.slice(0, packageSectionIndex) : lockfile
  const missingImporters = workspacePackages
    .map((item) => item.path.split(sep).join('/'))
    .filter((path) => !new RegExp(`^  ${escapeRegExp(path)}, 'm').test(importerSection))

  if (missingImporters.length > 0) {
    warnings.push(
      `pnpm-lock.yaml is missing workspace importer entries for: ${missingImporters.join(', ')}. Run "pnpm run lockfile:refresh" and commit the regenerated lockfile.`
    )
  }

  const ciPath = '.github/workflows/ci.yml'
  const weeklyPath = '.github/workflows/weekly-detection.yml'
  if (!(await exists(ciPath))) errors.push(`Missing required workflow: ${ciPath}`)
  if (!(await exists(weeklyPath))) errors.push(`Missing required workflow: ${weeklyPath}`)

  const preCommit = await readText('.husky/pre-commit')
  for (const forbidden of ['generate-commit', 'KILO_API_KEY', 'CHANGELOG.md', 'package.json']) {
    if (preCommit.includes(forbidden)) {
      errors.push(`pre-commit must not invoke or mutate release/AI state; found "${forbidden}".`)
    }
  }

  const envExample = await readText('.env.example')
  if (!envExample.includes('GITHUB_REPO=MOONWITNESS')) {
    warnings.push('.env.example should use the canonical GITHUB_REPO=MOONWITNESS value.')
  }

  if (await exists('services')) {
    const serviceEntries = await readdir(resolve(root, 'services'), { withFileTypes: true })
    for (const entry of serviceEntries) {
      if (entry.isDirectory() && (await exists(`services/${entry.name}/package.json`))) {
        notes.push(
          `Legacy service excluded from pnpm workspace: services/${entry.name}. Do not execute it as a canonical app.`
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
