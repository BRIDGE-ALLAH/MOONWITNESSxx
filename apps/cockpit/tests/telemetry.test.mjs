import test from 'node:test'
import assert from 'node:assert/strict'

function resetGlobals() {
  delete globalThis.window
  delete globalThis.fetch
  delete globalThis.performance
  if (globalThis.AbortSignal?.timeout?.__mocked) delete globalThis.AbortSignal.timeout
}

test('telemetry lib', async (t) => {
  await t.test('uses backend snapshot in Tauri when available', async () => {
    resetGlobals()
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd, args) => {
          assert.equal(cmd, 'get_cockpit_telemetry')
          assert.deepEqual(args, { environment: 'production' })
          return {
            timestamp: '2026-01-01T00:00:00Z',
            environment: 'production',
            targetHost: 'prod-host',
            probe: { status: 'HEALTHY', latencyMs: 1, target: 'x', ok: true },
            nodes: [],
            recentLogs: [],
          }
        },
      },
    }
    const { fetchCockpitTelemetry } = await import(`../src/lib/telemetry.ts?be=${Date.now()}`)
    const snap = await fetchCockpitTelemetry('production')
    assert.equal(snap.source, 'backend')
    assert.equal(snap.environment, 'production')
    resetGlobals()
  })

  await t.test(
    'falls back to frontend probes when backend invoke fails (web/Tauri error)',
    async () => {
      resetGlobals()
      let now = 0
      globalThis.performance = { now: () => (now += 10) }
      globalThis.fetch = async (url) => {
        if (String(url).includes('4000')) return { ok: true }
        throw new Error('nope')
      }
      // ensure AbortSignal.timeout exists in Node; if not, provide a stub
      if (!globalThis.AbortSignal) globalThis.AbortSignal = {}
      if (!globalThis.AbortSignal.timeout) globalThis.AbortSignal.timeout = () => undefined
      globalThis.window = {
        __TAURI__: {
          invoke: async () => {
            throw new Error('backend missing')
          },
        },
      }

      const { fetchCockpitTelemetry } = await import(`../src/lib/telemetry.ts?fb=${Date.now()}`)
      const snap = await fetchCockpitTelemetry('development')
      assert.equal(snap.source, 'frontend')
      assert.equal(snap.environment, 'development')
      assert.ok(snap.nodes.length >= 4)

      const arsy = snap.nodes.find((n) => n.id === 'arsy')
      assert.equal(arsy.source, 'frontend')
      assert.equal(arsy.status, 'HEALTHY')
      assert.equal(arsy.probe.kind, 'http')

      const tcpNodes = snap.nodes.filter((n) => n.probe.kind === 'tcp')
      assert.ok(tcpNodes.length >= 2)
      for (const n of tcpNodes) {
        assert.equal(n.status, 'OFFLINE')
        assert.match(String(n.probe.error ?? ''), /tcp probe unavailable/i)
      }
      resetGlobals()
    }
  )

  await t.test('frontend HTTP probe reports offline on fetch failure', async () => {
    resetGlobals()
    let now = 0
    globalThis.performance = { now: () => (now += 5) }
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED')
    }
    if (!globalThis.AbortSignal) globalThis.AbortSignal = {}
    if (!globalThis.AbortSignal.timeout) globalThis.AbortSignal.timeout = () => undefined

    const { fetchCockpitTelemetry } = await import(`../src/lib/telemetry.ts?off=${Date.now()}`)
    const snap = await fetchCockpitTelemetry('local')
    const arsy = snap.nodes.find((n) => n.id === 'arsy')
    assert.equal(arsy.status, 'OFFLINE')
    assert.equal(arsy.probe.ok, false)
    assert.match(String(arsy.probe.error), /ECONNREFUSED|error/i)
    resetGlobals()
  })

  await t.test('unknown env falls back safely (no undefined, uses default env)', async () => {
    resetGlobals()
    let now = 0
    globalThis.performance = { now: () => (now += 5) }
    globalThis.fetch = async () => ({ ok: true })
    if (!globalThis.AbortSignal) globalThis.AbortSignal = {}
    if (!globalThis.AbortSignal.timeout) globalThis.AbortSignal.timeout = () => undefined

    const { fetchCockpitTelemetry } = await import(`../src/lib/telemetry.ts?unk=${Date.now()}`)
    const snap = await fetchCockpitTelemetry('staging-typo-unknown')
    assert.equal(snap.source, 'frontend')
    assert.equal(snap.environment, 'local')
    assert.ok(Array.isArray(snap.nodes) && snap.nodes.length >= 4)
    assert.ok(snap.probe && typeof snap.probe.target === 'string')
    resetGlobals()
  })
})
