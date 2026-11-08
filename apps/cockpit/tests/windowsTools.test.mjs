import test from 'node:test'
import assert from 'node:assert/strict'
import {
  scanWindowsCleanableTargets,
  executeWindowsClean,
  flushWindowsNetwork,
  optimizeWindowsMemory,
  scanZombieDevProcesses,
  terminateDevProcess,
} from '../src/lib/windowsTools.ts'

test('Windows Tools & Maintenance Suite', async (t) => {
  await t.test('scanWindowsCleanableTargets discovers temporary files and caches', async () => {
    const scan = await scanWindowsCleanableTargets()
    assert.ok(scan.categories.length >= 3)
    assert.ok(scan.totalBytes > 0)
    assert.ok(scan.totalFiles > 0)
    assert.ok(scan.scannedAt)

    const tempCategory = scan.categories.find((c) => c.id === 'temp_user')
    assert.ok(tempCategory)
    assert.equal(tempCategory.safeToDelete, true)
  })

  await t.test(
    'executeWindowsClean dry-run validates targets without destructive removal',
    async () => {
      const res = await executeWindowsClean(['temp_user', 'crash_dumps'], true)
      assert.ok(res.freedBytes > 0)
      assert.ok(res.removedFiles > 0)
      assert.equal(res.failedFiles, 0)
      assert.ok(res.details.some((d) => d.includes('[DRY-RUN]')))
    }
  )

  await t.test('executeWindowsClean live execution runs governed purge', async () => {
    const res = await executeWindowsClean(['temp_user'], false)
    assert.ok(res.freedBytes > 0)
    assert.ok(res.details.some((d) => d.includes('[CLEANED]')))
  })

  await t.test('flushWindowsNetwork executes DNS resolver flush and resets sockets', async () => {
    const res = await flushWindowsNetwork()
    assert.equal(res.dnsFlushed, true)
    assert.equal(res.routeTableRefreshed, true)
    assert.ok(res.latencyMs >= 0)
    assert.ok(res.output.includes('DNS Resolver Cache'))
  })

  await t.test('optimizeWindowsMemory releases unreserved working set memory', async () => {
    const res = await optimizeWindowsMemory()
    assert.ok(res.previousUsedMb > res.currentUsedMb)
    assert.ok(res.freedMb > 0)
    assert.equal(res.totalMb, 32768)
  })

  await t.test('scanZombieDevProcesses surfaces lingering development listeners', async () => {
    const procs = await scanZombieDevProcesses()
    assert.ok(Array.isArray(procs))
    assert.ok(procs.length > 0)
    assert.ok(procs[0].pid > 0)
    assert.ok(procs[0].port)
  })

  await t.test('terminateDevProcess terminates target PID safely', async () => {
    const res = await terminateDevProcess(24190, 'node.exe')
    assert.equal(res.success, true)
    assert.equal(res.pid, 24190)
    assert.ok(res.message.includes('[KILLED]'))
  })
})
