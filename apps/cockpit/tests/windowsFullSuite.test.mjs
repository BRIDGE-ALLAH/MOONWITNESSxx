import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchWindowsFullOpsSnapshot, executeToolQuickAction } from '../src/lib/windowsFullSuite.ts'

test('Windows Mega Toolkit (20 Enterprise Utilities)', async (t) => {
  await t.test('fetchWindowsFullOpsSnapshot exposes exactly 20 distinct tools', async () => {
    const snapshot = await fetchWindowsFullOpsSnapshot()
    assert.equal(snapshot.tools.length, 20)
    for (let i = 1; i <= 20; i++) {
      const tool = snapshot.tools.find((t) => t.num === i)
      assert.ok(tool, `Tool #${i} must exist in snapshot`)
      assert.ok(tool.title.length > 0)
      assert.ok(tool.description.length > 0)
    }
  })

  await t.test(
    'snapshot contains detailed sub-telemetry contracts for each subsystem',
    async () => {
      const s = await fetchWindowsFullOpsSnapshot()
      // 1. Firewall
      assert.ok(s.firewall.length > 0)
      assert.equal(s.firewall[0].action, 'Allow')

      // 4. Git
      assert.equal(s.gitHealth.clean, true)

      // 6. WSL2
      assert.ok(s.wslDistros.length > 0)
      assert.equal(s.wslDistros[0].version, 2)

      // 8. Power
      assert.ok(s.powerPlans.some((p) => p.active))

      // 13. Benchmark
      assert.ok(s.benchmark.requestsPerSec > 0)

      // 18. Runtime
      assert.ok(s.runtimeSwitch.activeNode.startsWith('v'))

      // 20. Security
      assert.equal(s.security.secureBootEnabled, true)
      assert.equal(s.security.projectDriveEncrypted, true)
    }
  )

  await t.test('executeToolQuickAction performs valid dispatch with action feedback', async () => {
    for (const num of [1, 4, 13, 20]) {
      const res = await executeToolQuickAction(num, 'optimize')
      assert.equal(res.success, true)
      assert.ok(res.message.includes(`TOOL #${num}`))
    }
  })
})
