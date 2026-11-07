import { spawnSync } from 'node:child_process'

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options
  })
}

for (const [label, args] of [
  ['staged', ['diff', '--cached', '--quiet', '--', 'pnpm-lock.yaml']],
  ['working tree', ['diff', '--quiet', '--', 'pnpm-lock.yaml']]
]) {
  const status = run('git', args)

  if (status.status === 1) {
    console.error(
      `Refusing to refresh pnpm-lock.yaml because it already has ${label} changes. Preserve and review those changes first.`
    )
    process.exit(1)
  }

  if (status.error || status.status !== 0) {
    console.error(status.error?.message ?? `Unable to inspect staged or ${label} lockfile state.`)
    process.exit(status.status ?? 1)
  }
}

const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = run(
  executable,
  ['install', '--lockfile-only', '--no-frozen-lockfile', '--ignore-scripts'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
)

if (result.error) {
  console.error(`Unable to refresh pnpm-lock.yaml: ${result.error.message}`)
  process.exit(1)
}

if (result.status !== 0) {
  console.error('pnpm could not refresh the workspace lockfile.')
  process.exit(result.status ?? 1)
}

const diff = run('git', ['diff', '--exit-code', '--', 'pnpm-lock.yaml'], { stdio: 'inherit' })
if (diff.error || (diff.status !== 0 && diff.status !== 1)) {
  console.error(diff.error?.message ?? 'Unable to inspect the refreshed lockfile diff.')
  process.exit(diff.status ?? 1)
}

if (diff.status === 1) {
  console.log(
    [
      'pnpm-lock.yaml was refreshed successfully.',
      'Review the diff and commit it with the corresponding manifest changes.',
      'No files were staged automatically.'
    ].join('\n')
  )
} else {
  console.log('pnpm-lock.yaml is already synchronized; no changes were required.')
}
