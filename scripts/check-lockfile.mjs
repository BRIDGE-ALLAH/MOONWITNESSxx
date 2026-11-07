import { spawnSync } from 'node:child_process'

const refresh = process.argv.includes('--lockfile-only')

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options })
}

if (refresh) {
  const staged = run('git', ['diff', '--cached', '--quiet', '--', 'pnpm-lock.yaml'])
  const worktree = run('git', ['diff', '--quiet', '--', 'pnpm-lock.yaml'])
  if (staged.status === 1 || worktree.status === 1) {
    console.error('Refusing to refresh pnpm-lock.yaml because it already has local changes.')
    process.exit(1)
  }
  if (staged.status !== 0 || worktree.status !== 0) {
    console.error('Unable to inspect pnpm-lock.yaml Git status.')
    process.exit(1)
  }
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const args = ['install', '--lockfile-only', '--ignore-scripts']
if (!refresh) args.push('--frozen-lockfile')

const result = run(pnpm, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? 'pnpm could not validate or refresh the lockfile.')
  process.exit(result.status ?? 1)
}
console.log(refresh
  ? 'Lockfile refresh completed. Review and commit the diff with its manifest changes.'
  : 'pnpm-lock.yaml is in sync with workspace manifests.')
