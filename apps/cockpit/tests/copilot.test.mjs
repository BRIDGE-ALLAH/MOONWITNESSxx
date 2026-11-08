import test from 'node:test'
import assert from 'node:assert/strict'

function baseSnapshot(overrides = {}) {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    environment: 'test-env',
    targetHost: 'test-host',
    probe: {
      status: 'HEALTHY',
      latencyMs: 12,
      target: 'http://localhost:4000/health/live',
      ok: true,
    },
    nodes: [
      {
        id: 'arsy',
        name: 'ARSY CORE',
        category: 'core',
        port: 4000,
        status: 'HEALTHY',
        latencyMs: 10,
        uptime: '99%',
        load: '1',
      },
    ],
    recentLogs: [],
    source: 'frontend',
    ...overrides,
  }
}

function makeLocalStorage() {
  const store = new Map()
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) }
}

function resetGlobals() {
  delete globalThis.window
  delete globalThis.localStorage
}

test('copilot provider switching/fallback', async (t) => {
  await t.test('local-heuristic provider uses local analyzer', async () => {
    resetGlobals()
    const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?local=${Date.now()}`)
    const res = await analyzeCopilotProvider(baseSnapshot(), 'status summary', 'local-heuristic')
    assert.equal(res.provider, 'local-heuristic')
    assert.ok(res.citations.length > 0)
  })

  await t.test('remote-llm outside Tauri falls back to local-heuristic', async () => {
    resetGlobals()
    globalThis.localStorage = makeLocalStorage()
    const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?web=${Date.now()}`)
    const res = await analyzeCopilotProvider(baseSnapshot(), 'status summary', 'remote-llm')
    assert.equal(res.provider, 'local-heuristic')
  })

  await t.test('remote-llm in Tauri uses invoke and returns remote result', async () => {
    resetGlobals()
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd, args) => {
          assert.equal(cmd, 'llm_analyze')
          assert.equal(args.question, 'q')
          return {
            answer: 'remote',
            confidence: 'High',
            citations: ['c1'],
            suggestedActions: [],
            provider: 'remote-llm',
            disclaimer: 'd',
          }
        },
      },
    }
    const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?remote=${Date.now()}`)
    const res = await analyzeCopilotProvider(baseSnapshot(), 'q', 'remote-llm')
    assert.equal(res.provider, 'remote-llm')
    assert.equal(res.answer, 'remote')
    resetGlobals()
  })

  await t.test('remote-llm opt-in streaming calls llm_analyze_stream in Tauri', async () => {
    resetGlobals()
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd, args) => {
          assert.equal(cmd, 'llm_analyze_stream')
          assert.equal(args.question, 'q')
          return {
            answer: 'streamed',
            confidence: 'Medium',
            citations: ['c1'],
            suggestedActions: [],
            provider: 'remote-llm',
            disclaimer: 'd',
            model: 'llama3',
          }
        },
      },
    }
    const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?stream=${Date.now()}`)
    const res = await analyzeCopilotProvider(baseSnapshot(), 'q', 'remote-llm', { stream: true })
    assert.equal(res.provider, 'remote-llm')
    assert.equal(res.answer, 'streamed')
    resetGlobals()
  })

  await t.test('remote-llm non-streaming default does not call stream command', async () => {
    resetGlobals()
    globalThis.window = {
      __TAURI__: {
        invoke: async (cmd) => {
          assert.equal(cmd, 'llm_analyze')
          return {
            answer: 'ok',
            confidence: 'High',
            citations: [],
            suggestedActions: [],
            provider: 'remote-llm',
            disclaimer: 'd',
          }
        },
      },
    }
    const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?nostream=${Date.now()}`)
    const res = await analyzeCopilotProvider(baseSnapshot(), 'q', 'remote-llm', { stream: false })
    assert.equal(res.provider, 'remote-llm')
    resetGlobals()
  })

  await t.test(
    'remote-llm stream failure falls back to local with provider-switch audit',
    async () => {
      resetGlobals()
      globalThis.localStorage = makeLocalStorage()
      globalThis.window = {
        __TAURI__: {
          invoke: async (cmd) => {
            assert.equal(cmd, 'llm_analyze_stream')
            throw new Error('stream down')
          },
        },
      }
      const { analyzeCopilotProvider } = await import(
        `../src/lib/copilot.ts?streamfail=${Date.now()}`
      )
      const res = await analyzeCopilotProvider(baseSnapshot(), 'status summary', 'remote-llm', {
        stream: true,
        correlationId: 'corr-1',
      })
      assert.equal(res.provider, 'local-heuristic')
      assert.match(res.fallbackReason ?? '', /Remote LLM unavailable/)
      const raw = globalThis.localStorage.getItem('cockpit-audit-v1')
      const events = raw ? JSON.parse(raw) : []
      const sw = events.find((e) => e.type === 'provider-switch')
      assert.ok(sw)
      assert.equal(sw.correlationId, 'corr-1')
      assert.equal(sw.metadata?.from, 'remote-llm-stream')
      assert.equal(sw.metadata?.to, 'local-heuristic')
      resetGlobals()
    }
  )

  await t.test(
    'remote-llm invoke failure falls back to local and records provider-switch audit',
    async () => {
      resetGlobals()
      globalThis.localStorage = makeLocalStorage()
      globalThis.window = {
        __TAURI__: {
          invoke: async () => {
            throw new Error('llm down')
          },
        },
      }
      const { analyzeCopilotProvider } = await import(`../src/lib/copilot.ts?fail=${Date.now()}`)
      const res = await analyzeCopilotProvider(baseSnapshot(), 'status summary', 'remote-llm')
      assert.equal(res.provider, 'local-heuristic')
      const raw = globalThis.localStorage.getItem('cockpit-audit-v1')
      const events = raw ? JSON.parse(raw) : []
      assert.ok(events.some((e) => e.type === 'provider-switch'))
      resetGlobals()
    }
  )
})
