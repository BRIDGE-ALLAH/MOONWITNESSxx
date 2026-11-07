import { spawnSync } from 'node:child_process'

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(
  executable,
  ['install', '--lockfile-only', '--frozen-lockfile', '--ignore-scripts'],
  {
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  }
)

if (result.error) {
  console.error(`Unable to verify pnpm-lock.yaml: ${result.error.message}`)
  process.exit(1)
}

if (result.status !== 0) {
  console.error(
    [
      'pnpm-lock.yaml is not synchronized with the workspace manifests.',
      'Run "pnpm run lockfile:refresh", review the lockfile diff, and commit it.',
      'This check is read-only and never rewrites the lockfile.',
    ].join('\n')
  )
  process.exit(result.status ?? 1)
}

console.log('pnpm-lock.yaml matches the workspace manifests (frozen, read-only check).')
