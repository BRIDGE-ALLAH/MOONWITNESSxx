import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const supportedExtensions = /\.(?:css|html|js|json|jsx|md|mdx|mjs|scss|sh|ts|tsx|yaml|yml)$/

function runGit(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })
}

export function isPrettierSupportedFile(file) {
  return (
    file !== 'pnpm-lock.yaml' &&
    !file.startsWith('.github/workflows/') &&
    supportedExtensions.test(file)
  )
}

export function uniqueFilePaths(paths) {
  return [...new Set(paths.filter(Boolean))].sort()
}

function splitNullSeparatedPaths(output) {
  return output.split('\0').filter(Boolean)
}

function getLocalChangedFiles() {
  const diff = runGit(['diff', 'HEAD', '--name-only', '--diff-filter=ACMR', '-z'])
  if (diff.error || diff.status !== 0) {
    throw new Error(diff.error?.message ?? 'Unable to inspect local Git changes.')
  }

  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z'])
  if (untracked.error || untracked.status !== 0) {
    throw new Error(untracked.error?.message ?? 'Unable to inspect untracked Git files.')
  }

  return uniqueFilePaths([
    ...splitNullSeparatedPaths(diff.stdout),
    ...splitNullSeparatedPaths(untracked.stdout),
  ])
}

async function getCiChangedFiles() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  const event = eventPath ? JSON.parse(await readFile(eventPath, 'utf8')) : {}
  const baseRef = process.env.GITHUB_BASE_REF
  let rangeStart = ''

  if (baseRef) {
    const base = `origin/${baseRef}`
    const mergeBase = runGit(['merge-base', base, 'HEAD'])
    if (mergeBase.error || mergeBase.status !== 0) {
      throw new Error(mergeBase.error?.message ?? `Unable to find merge base with ${base}.`)
    }
    rangeStart = mergeBase.stdout.trim()
  } else if (typeof event.before === 'string' && !/^0+$/.test(event.before)) {
    rangeStart = event.before
  } else {
    // workflow_dispatch or first push: validate the checked-out commit only.
    const parent = runGit(['rev-parse', 'HEAD^'])
    if (parent.status === 0) {
      rangeStart = parent.stdout.trim()
    }
  }

  const diff = rangeStart
    ? runGit(['diff', '--name-only', '--diff-filter=ACMR', '-z', `${rangeStart}...HEAD`])
    : runGit(['ls-tree', '-r', '--name-only', '-z', 'HEAD'])

  if (diff.error || diff.status !== 0) {
    throw new Error(diff.error?.message ?? 'Unable to inspect changed files in CI.')
  }

  return splitNullSeparatedPaths(diff.stdout)
}

export async function getChangedFiles() {
  const files = process.argv.includes('--all')
    ? splitNullSeparatedPaths(runGit(['ls-tree', '-r', '--name-only', '-z', 'HEAD']).stdout)
    : process.env.CI === 'true'
      ? await getCiChangedFiles()
      : getLocalChangedFiles()

  return uniqueFilePaths(files).filter(isPrettierSupportedFile)
}

export async function runFormat() {
  let files
  try {
    files = await getChangedFiles()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return
  }

  if (files.length === 0) {
    console.log('No changed supported files require a Prettier check.')
    return
  }

  const write = process.argv.includes('--write')
  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(
    executable,
    ['exec', 'prettier', write ? '--write' : '--check', '--ignore-unknown', ...files],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    }
  )

  if (result.error) {
    console.error(`Unable to run Prettier: ${result.error.message}`)
    process.exitCode = 1
    return
  }

  if (result.status !== 0) process.exitCode = result.status ?? 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runFormat()
}
