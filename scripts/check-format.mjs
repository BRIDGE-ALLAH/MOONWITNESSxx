import { spawnSync } from 'node:child_process'

const supportedExtensions = /\.(?:css|html|js|json|jsx|mjs|scss|sh|ts|tsx|yaml|yml)$/

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options
  })
}

function readGitPaths(args, label) {
  const result = run('git', args)
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `Unable to inspect ${label}.`)
    process.exit(1)
  }
  return result.stdout.split('\0').filter(Boolean)
}

function uniqueSupportedFiles(paths) {
  return [...new Set(paths)].filter((path) => supportedExtensions.test(path))
}

const formatAll = process.argv.includes('--all')
const baseSha = process.env.FORMAT_BASE_SHA
let paths = []

if (formatAll) {
  const prettier = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = run(prettier, ['exec', 'prettier', '--check', '.', '--ignore-unknown'], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.error) {
    console.error(`Unable to run Prettier: ${result.error.message}`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}

if (baseSha && /^[0-9a-f]{40}$/i.test(baseSha) && !/^0{40}$/i.test(baseSha)) {
  paths = readGitPaths(
    ['diff', '--name-only', '--diff-filter=ACMR', '-z', `${baseSha}...HEAD`],
    `changed files between base ${baseSha} and HEAD`
  )
} else {
  paths = [
    ...readGitPaths(['diff', '--name-only', '--diff-filter=ACMR', '-z', 'HEAD'], 'working tree changes'),
    ...readGitPaths(['ls-files', '--others', '--exclude-standard', '-z'], 'untracked files')
  ]
}

const files = uniqueSupportedFiles(paths)
if (files.length === 0) {
  console.log('No changed text/config files to format-check. Use pnpm run format:check:all for a full-repository audit.')
  process.exit(0)
}

const prettier = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
console.log(`Checking formatting for ${files.length} changed file(s).`)
const result = run(
  prettier,
  ['exec', 'prettier', '--check', '--ignore-unknown', ...files],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
)

if (result.error) {
  console.error(`Unable to run Prettier: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
