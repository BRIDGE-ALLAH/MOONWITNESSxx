/**
 * Backwards-compatible entrypoint.
 *
 * Auto-detection is now read-only and does not create GitHub issues. Run
 * `pnpm run audit:repo` for a report, or `pnpm run lockfile:check` for lockfile drift.
 */
import('./repo-audit.mjs')
  .then(({ runAudit }) => runAudit({ writeReport: true }))
  .catch((error) => {
    console.error('Repository audit failed:', error)
    process.exitCode = 1
  })
