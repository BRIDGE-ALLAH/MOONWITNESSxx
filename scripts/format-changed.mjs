import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const supported = /\.(?:css|html|js|json|jsx|md|mdx|mjs|scss|sh|ts|tsx|yaml|yml)$/

export function filterPrettierFiles(files) {
  return [...new Set(files.filter((file) => supported.test(file)))]
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options })
}

function gitFiles(args) {
  const result = run('git', args)
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? 'Unable to determine changed files for formatting.')
  }
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

export async function runFormatCheck() {
  const write = process.argv.includes('--write')
  const base = process.env.FORMAT_BASE_SHA
  const branch = gitFiles(['branch', '--show-current'])[0]
  let changed = []

  if (base) {
    // CI validates the committed PR/push diff only; installs may generate ignored or local files.
    changed.push(...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`]))
  } else {
    if (branch !== 'main' && run('git', ['rev-parse', '--verify', 'origin/main']).status === 0) {
      const mergeBase = gitFiles(['merge-base', 'origin/main', 'HEAD'])[0]
      changed.push(
        ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR', `${mergeBase}...HEAD`])
      )
    }
    changed.push(
      ...gitFiles(['diff', '--name-only', '--diff-filter=ACMR']),
      ...gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    )
  }

  const excluded = new Set((process.env.FORMAT_EXCLUDE ?? '').split(';').filter(Boolean))
  const files = filterPrettierFiles(changed).filter((file) => !excluded.has(file))
  if (files.length === 0) {
    console.log('No changed supported files require formatting.')
    return 0
  }

  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = run(
    executable,
    ['exec', 'prettier', write ? '--write' : '--check', '--ignore-unknown', ...files],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  )

  if (result.error) {
    console.error(result.error.message)
    return 1
  }
  return result.status ?? 1
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await runFormatCheck()
}
