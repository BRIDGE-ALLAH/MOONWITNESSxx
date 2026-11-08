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
  await t.test('ACTIONS_META exposes expected actions with safety flags', async () => {
    const { ACTIONS_META } = await import(`../src/lib/actions.ts?meta=${Date.now()}`)
    assert.equal(ACTIONS_META.length, 4)
    const byId = Object.fromEntries(ACTIONS_META.map((a) => [a.id, a]))
    assert.equal(byId.DIAGNOSTIC_HEALTH_CHECK.destructive, false)
    assert.equal(byId.DIAGNOSTIC_HEALTH_CHECK.privileged, false)
    assert.equal(byId.FLUSH_CONTAINER_CACHE.privileged, true)
    assert.equal(byId.CYCLE_SOCKET_CONNECTOR.privileged, true)
    assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.destructive, true)
    assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.privileged, true)
    assert.equal(byId.EMERGENCY_DEGRADE_SYSTEM.token, 'CONFIRM LOCKDOWN')
  })

  await t.test('findAction returns matching metadata', async () => {
    const { findAction } = await import(`../src/lib/actions.ts?find=${Date.now()}`)
    const a = findAction('FLUSH_CONTAINER_CACHE')
    assert.equal(a.id, 'FLUSH_CONTAINER_CACHE')
    assert.match(a.label, /Redis|Cache/i)
  })

  await t.test('audit helpers append expected event types (localStorage fallback)', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    // ensure deterministic-ish ids exist in Node; crypto.randomUUID is available in modern Node
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
    assert.match(String(marker.metadata?.note ?? ''), /intent only/i)

    const cancelled = events.find((e) => e.type === 'action-cancelled')
    assert.equal(cancelled.result, 'denied')
    resetGlobals()
  })
})
