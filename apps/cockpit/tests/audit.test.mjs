import test from 'node:test'
import assert from 'node:assert/strict'

function makeLocalStorage() {
  const store = new Map()
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  }
}

function resetGlobals() {
  delete globalThis.window
  delete globalThis.localStorage
}

test('audit lib', async (t) => {
  await t.test('appendAudit/readAudit use localStorage fallback outside Tauri', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    const { appendAudit, readAudit } = await import(`../src/lib/audit.ts?ls=${Date.now()}`)
    await appendAudit({
      id: 'a1',
      ts: '2026-01-01T00:00:00Z',
      type: 'action-requested',
      actionId: 'DIAGNOSTIC_HEALTH_CHECK',
    })
    await appendAudit({
      id: 'a2',
      ts: '2026-01-01T00:00:01Z',
      type: 'action-confirmed',
      actionId: 'DIAGNOSTIC_HEALTH_CHECK',
    })
    const events = await readAudit(10)
    assert.equal(events.length, 2)
    // readAudit returns most recent first (slice(-limit).reverse())
    assert.equal(events[0].id, 'a2')
    assert.equal(events[1].id, 'a1')
    resetGlobals()
  })

  await t.test('readAudit returns [] when localStorage is empty', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    const { readAudit } = await import(`../src/lib/audit.ts?empty=${Date.now()}`)
    const events = await readAudit(5)
    assert.deepEqual(events, [])
    resetGlobals()
  })

  await t.test('appendAudit uses Tauri invoke when available', async () => {
    resetGlobals()
    const calls = []
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd, args) => {
          calls.push([cmd, args])
          if (cmd === 'audit_read') return [{ id: 't1', ts: 'x', type: 'execution-marker' }]
          return undefined
        },
      },
    }
    const { appendAudit, readAudit } = await import(`../src/lib/audit.ts?tauri=${Date.now()}`)
    const event = { id: 'x1', ts: '2026-01-01T00:00:00Z', type: 'copilot-draft' }
    await appendAudit(event)
    assert.equal(calls[0][0], 'audit_append')
    assert.deepEqual(calls[0][1], { event })
    const read = await readAudit(7)
    assert.equal(calls[1][0], 'audit_read')
    assert.deepEqual(calls[1][1], { limit: 7 })
    assert.deepEqual(read, [{ id: 't1', ts: 'x', type: 'execution-marker' }])
    resetGlobals()
  })

  await t.test('appendAudit falls back to localStorage when Tauri invoke fails', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    globalThis.window = {
      __TAURI__: {
        invoke: async () => {
          throw new Error('no backend')
        },
      },
    }
    const { appendAudit, readAudit } = await import(`../src/lib/audit.ts?fb=${Date.now()}`)
    await appendAudit({ id: 'fb1', ts: '2026-01-01T00:00:00Z', type: 'telemetry-degraded' })
    // readAudit will try tauri and fail, then fall back to localStorage
    const events = await readAudit(10)
    assert.equal(events.length, 1)
    assert.equal(events[0].id, 'fb1')
    resetGlobals()
  })
})
