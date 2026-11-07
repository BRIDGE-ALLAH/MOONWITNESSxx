import assert from 'node:assert/strict'
import test from 'node:test'

import { runAudit } from './repo-audit.mjs'

test('repository governance audit has no structural errors', async () => {
  const report = await runAudit()
  assert.equal(report.repository, 'BRIDGE-ALLAH/MOONWITNESS')
  assert.deepEqual(report.errors, [])
})
