import test from 'node:test'
import assert from 'node:assert/strict'

function makeLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    _store: store,
  }
}

function resetGlobals() {
  delete globalThis.window
  delete globalThis.localStorage
}

test('actions lib', async (t) => {
  await t.test(
    'ACTIONS_META exposes expected actions with safety flags and execution boundary',
    async () => {
      const { ACTIONS_META } = await import(`../src/lib/actions.ts?meta=${Date.now()}`)
      assert.equal(ACTIONS_META.length, 4)
      const byId = Object.fromEntries(ACTIONS_META.map((a) => [a.id, a]))
      assert.equal(byId.DIAGNOSTIC_HEALTH_CHECK.destructive, false)
      assert.equal(byId.DIAGNOSTIC_HEALTH_CHECK.privileged, false)
      assert.equal(byId.DIAGNOSTIC_HEALTH_CHECK.realExecution, 'read-only-tauri')
      assert.equal(byId.FLUSH_CONTAINER_CACHE.privileged, true)
      assert.equal(byId.FLUSH_CONTAINER_CACHE.realExecution, 'intent-only')
      assert.equal(byId.CYCLE_SOCKET_CONNECTOR.privileged, true)
      assert.equal(byId.CYCLE_SOCKET_CONNECTOR.realExecution, 'intent-only')
      assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.destructive, true)
      assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.privileged, true)
      assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.token, 'CONFIRM LOCKDOWN')
      assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.realExecution, 'intent-only')
    }
  )

  await t.test('findAction returns matching metadata', async () => {
    const { findAction } = await import(`../src/lib/actions.ts?find=${Date.now()}`)
    const a = findAction('FLUSH_CONTAINER_CACHE')
    assert.equal(a.id, 'FLUSH_CONTAINER_CACHE')
    assert.match(a.label, /Redis|Cache/i)
  })

  await t.test(
    'audit helpers append expected event types; default intent-only marker (localStorage fallback)',
    async () => {
      resetGlobals()
      globalThis.localStorage = makeLocalStorage()
      const { auditRequested, auditConfirmed, auditCancelled } = await import(
        `../src/lib/actions.ts?audit=${Date.now()}`
      )
      await auditRequested('DIAGNOSTIC_HEALTH_CHECK', 'operator', 'prod')
      await auditConfirmed('DIAGNOSTIC_HEALTH_CHECK', 'copilot-draft', 'prod')
      await auditCancelled('EMERGENCY_DEGRADE_SYSTEM', 'operator', 'prod')

      const raw = globalThis.localStorage.getItem('cockpit-audit-v1')
      const events = JSON.parse(raw)
      const types = events.map((e) => e.type)
      assert.ok(types.includes('action-requested'))
      assert.ok(types.includes('action-confirmed'))
      assert.ok(types.includes('execution-marker'))
      assert.ok(types.includes('action-cancelled'))

      const marker = events.find((e) => e.type === 'execution-marker')
      assert.equal(marker.result, 'executed')
      assert.equal(marker.metadata?.mode, 'intent-only')
      assert.match(String(marker.metadata?.note ?? ''), /intent only/i)

      const cancelled = events.find((e) => e.type === 'action-cancelled')
      assert.equal(cancelled.result, 'denied')
      resetGlobals()
    }
  )

  await t.test('auditConfirmed accepts read-only-executed marker metadata', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    const { auditConfirmed } = await import(`../src/lib/actions.ts?ro=${Date.now()}`)
    await auditConfirmed('DIAGNOSTIC_HEALTH_CHECK', 'operator', 'local', 'corr-1', {
      mode: 'read-only-executed',
      outcome: 'executed',
      command: 'run_diagnostic_health_check',
      data: { host: 'h', memoryUsedMb: 1, memoryTotalMb: 2, processCount: 3 },
    })
    const events = JSON.parse(globalThis.localStorage.getItem('cockpit-audit-v1'))
    const marker = events.find((e) => e.type === 'execution-marker')
    assert.equal(marker.result, 'executed')
    assert.equal(marker.metadata?.mode, 'read-only-executed')
    assert.equal(marker.metadata?.command, 'run_diagnostic_health_check')
    assert.equal(marker.correlationId, 'corr-1')
    assert.equal(events.find((e) => e.type === 'action-confirmed')?.correlationId, 'corr-1')
    resetGlobals()
  })

  await t.test('auditConfirmed accepts read-only-executed error outcome honestly', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    const { auditConfirmed } = await import(`../src/lib/actions.ts?roerr=${Date.now()}`)
    await auditConfirmed('DIAGNOSTIC_HEALTH_CHECK', 'operator', 'local', 'corr-2', {
      mode: 'read-only-executed',
      outcome: 'error',
      command: 'run_diagnostic_health_check',
      detail: 'boom',
    })
    const events = JSON.parse(globalThis.localStorage.getItem('cockpit-audit-v1'))
    const marker = events.find((e) => e.type === 'execution-marker')
    assert.equal(marker.result, 'error')
    assert.equal(marker.metadata?.mode, 'read-only-executed')
    assert.equal(marker.metadata?.detail, 'boom')
    resetGlobals()
  })

  await t.test(
    'executeGovernedDiagnostic rejects non-allowlisted actions (intent-only boundary)',
    async () => {
      resetGlobals()
      globalThis.window = { __TAURI__: { invoke: async () => ({ shouldNotRun: true }) } }
      const { executeGovernedDiagnostic } = await import(`../src/lib/actions.ts?al=${Date.now()}`)
      for (const id of [
        'FLUSH_CONTAINER_CACHE',
        'CYCLE_SOCKET_CONNECTOR',
        'EMERGENCY_DEGRADE_SYSTEM',
      ]) {
        const r = await executeGovernedDiagnostic(id)
        assert.equal(r.ok, false)
        assert.match(r.error, /allowlist/i)
      }
      resetGlobals()
    }
  )

  await t.test(
    'executeGovernedDiagnostic requires desktop/Tauri for allowlisted action',
    async () => {
      resetGlobals()
      const { executeGovernedDiagnostic } = await import(
        `../src/lib/actions.ts?noweb=${Date.now()}`
      )
      const r = await executeGovernedDiagnostic('DIAGNOSTIC_HEALTH_CHECK')
      assert.equal(r.ok, false)
      assert.match(r.error, /tauri/i)
      resetGlobals()
    }
  )

  await t.test(
    'executeGovernedDiagnostic invokes allowlisted read-only command in Tauri',
    async () => {
      resetGlobals()
      const calls = []
      globalThis.window = {
        __TAURI__: {
          invoke: async (cmd) => {
            calls.push(cmd)
            return { ok: true, host: 'desk', memoryUsedMb: 10, memoryTotalMb: 20, processCount: 42 }
          },
        },
      }
      const { executeGovernedDiagnostic } = await import(
        `../src/lib/actions.ts?invok=${Date.now()}`
      )
      const r = await executeGovernedDiagnostic('DIAGNOSTIC_HEALTH_CHECK')
      assert.equal(r.ok, true)
      assert.deepEqual(calls, ['run_diagnostic_health_check'])
      assert.equal(r.data.processCount, 42)
      resetGlobals()
    }
  )
})
