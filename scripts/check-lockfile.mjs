import { spawnSync } from 'node:child_process'

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options })
}

const stagedStatus = run('git', ['diff', '--cached', '--quiet', '--', 'pnpm-lock.yaml'])
const worktreeStatus = run('git', ['diff', '--quiet', '--', 'pnpm-lock.yaml'])

if (stagedStatus.status === 1 || worktreeStatus.status === 1) {
  console.error(
    'Refusing to regenerate pnpm-lock.yaml because it already has local changes. Preserve and review those changes first.'
  )
  process.exit(1)
}
if (stagedStatus.status !== 0 || worktreeStatus.status !== 0) {
  console.error('Unable to inspect pnpm-lock.yaml Git status.')
  process.exit(1)
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const install = run(
  pnpm,
  ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts'],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)

if (install.error || install.status !== 0) {
  console.error(install.error?.message ?? 'pnpm could not regenerate the lockfile.')
  process.exit(install.status ?? 1)
}

const diff = run('git', ['diff', '--exit-code', '--', 'pnpm-lock.yaml'], { stdio: 'inherit' })
if (diff.status === 1) {
  console.error(
    [
      'pnpm-lock.yaml was stale and has been regenerated in the working tree.',
      'Review the diff, then commit it together with the manifest changes.',
      'CI remains blocked until the refreshed lockfile is committed.',
    ].join('\n')
  )
  process.exit(1)
}
if (diff.error || diff.status !== 0) {
  console.error(diff.error?.message ?? 'Unable to compare the regenerated lockfile.')
  process.exit(1)
}

console.log('pnpm-lock.yaml is in sync with workspace manifests.')
