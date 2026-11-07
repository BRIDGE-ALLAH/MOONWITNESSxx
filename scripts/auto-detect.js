/**
 * Repository auto-detection — read-only audit report.
 *
 * This script performs a read-only audit and writes a report under .artifacts/.
 * It does NOT create GitHub issues, modify release state, or stage files.
 *
 * Run `pnpm run audit:repo` for a full report, or `pnpm run lockfile:check` for lockfile drift.
 *
 * @author Codex Super Autonomous v5.0
 * @see docs/24-repository-and-automation-governance.md
 */
import('./repo-audit.mjs')
  .then(({ runAudit }) => runAudit({ writeReport: true, strict: true }))
  .catch((error) => {
    console.error('Repository audit failed:', error)
    process.exitCode = 1
  })
