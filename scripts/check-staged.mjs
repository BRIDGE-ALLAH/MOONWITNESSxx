import { spawnSync } from 'node:child_process'

const staged = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
})

if (staged.error || staged.status !== 0) {
  console.error(staged.error?.message ?? 'Unable to inspect staged Git files.')
  process.exit(1)
}

const supportedExtensions = /\.(?:css|html|js|json|jsx|md|mdx|mjs|scss|sh|ts|tsx|yaml|yml)$/
const files = staged.stdout.split('\0').filter((file) => file && supportedExtensions.test(file))

if (files.length === 0) {
  console.log('No staged text/config files require formatting checks.')
  process.exit(0)
}

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(
  executable,
  ['exec', 'prettier', '--check', '--ignore-unknown', ...files],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
)

if (result.error) {
  console.error(`Unable to run Prettier: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
