import { spawnSync } from 'node:child_process'

function runGit(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

if (process.env.CI === 'true') {
  console.log('CI detected; local Git hooks are not installed.')
} else {
  const root = runGit(['rev-parse', '--show-toplevel'])
  if (root.status !== 0) {
    console.log('Not inside a Git checkout; skipping local hook installation.')
  } else {
    const existing = runGit(['config', '--local', '--get', 'core.hooksPath'])
    const currentPath = existing.status === 0 ? existing.stdout.trim() : ''

    if (currentPath && currentPath !== '.husky') {
      console.warn(
        `Existing core.hooksPath="${currentPath}" is preserved. Review it manually if this repository should use .husky.`
      )
    } else if (currentPath !== '.husky') {
      const configured = runGit(['config', '--local', 'core.hooksPath', '.husky'])
      if (configured.status !== 0) {
        console.error(configured.stderr || 'Failed to configure core.hooksPath.')
        process.exit(1)
      }
      console.log('Configured local Git hooks: core.hooksPath=.husky')
    } else {
      console.log('Local Git hooks are already configured.')
    }
  }
}
