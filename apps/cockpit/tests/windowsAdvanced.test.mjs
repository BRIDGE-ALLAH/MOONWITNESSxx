import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchWindowsServices,
  controlWindowsService,
  auditEnvironmentPath,
  fetchHostsEntries,
  updateHostEntry,
  fetchHardwareHealth,
} from '../src/lib/windowsAdvanced.ts'

test('Windows Advanced Suite: Services, Path, Hosts, Hardware', async (t) => {
  await t.test('fetchWindowsServices discovers critical database and runtime daemons', async () => {
    const services = await fetchWindowsServices()
    assert.ok(services.length >= 3)
    assert.ok(services.some((s) => s.name.includes('postgresql')))
    assert.ok(services.some((s) => s.category === 'container'))
  })

  await t.test('controlWindowsService dispatches state change command', async () => {
    const outcome = await controlWindowsService('postgresql-x64-16', 'restart')
    assert.equal(outcome.success, true)
    assert.equal(outcome.action, 'restart')
    assert.ok(outcome.message.includes('RESTART'))
  })

  await t.test('auditEnvironmentPath inspects PATH health and detects toolchains', async () => {
    const report = await auditEnvironmentPath()
    assert.ok(report.totalPaths > 0)
    assert.ok(report.validPaths > 0)
    assert.ok(report.entries.some((e) => e.toolchainType === 'node'))
    assert.ok(report.detectedRuntimes.node)
  })

  await t.test('fetchHostsEntries reads local hosts aliases', async () => {
    const hosts = await fetchHostsEntries()
    assert.ok(hosts.filePath.includes('hosts'))
    assert.ok(hosts.entries.length > 0)
    assert.ok(hosts.entries.some((e) => e.hostname.includes('moonwitness')))
  })

  await t.test('updateHostEntry modifies active status with backup confirmation', async () => {
    const res = await updateHostEntry('dev.moonwitness.internal', false)
    assert.equal(res.success, true)
    assert.ok(res.message.includes('DISABLED'))
  })

  await t.test('fetchHardwareHealth polls CPU load and drive storage stats', async () => {
    const hw = await fetchHardwareHealth()
    assert.ok(hw.cpuUsagePercent >= 0)
    assert.ok(hw.drives.length >= 2)
    assert.ok(hw.drives[0].percentFree > 0)
    assert.ok(hw.diskThroughputMbSec > 0)
  })
})
