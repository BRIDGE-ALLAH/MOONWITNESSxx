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
      {
        id: 'db',
        name: 'DB',
        category: 'database',
        port: 5432,
        status: 'HEALTHY',
        latencyMs: 5,
        uptime: '99%',
        load: '1',
      },
    ],
    recentLogs: [],
    source: 'frontend',
    ...overrides,
  }
}

test('agiCopilot analyzeCopilot', async (t) => {
  await t.test('empty question returns low-confidence prompt guidance', async () => {
    const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?empty=${Date.now()}`)
    const res = analyzeCopilot(baseSnapshot(), '   ')
    assert.equal(res.confidence, 'Low')
    assert.equal(res.provider, 'local-heuristic')
    assert.match(res.disclaimer, /assistive|verify|approval/i)
    assert.ok(Array.isArray(res.citations) && res.citations.length >= 1)
    assert.deepEqual(res.suggestedActions, [])
  })

  await t.test('status/overview intent summarizes node counts and cites nodes', async () => {
    const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?sum=${Date.now()}`)
    const res = analyzeCopilot(baseSnapshot(), 'give me a status overview')
    assert.equal(res.provider, 'local-heuristic')
    assert.match(res.answer, /2 healthy/i)
    assert.ok(res.citations.some((c) => c.includes('ARSY CORE')))
    assert.ok(res.citations.some((c) => c.includes('Probe target')))
  })

  await t.test(
    'degraded intent explains offline nodes with citations and draft actions',
    async () => {
      const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?deg=${Date.now()}`)
      const snap = baseSnapshot({
        nodes: [
          {
            id: 'arsy',
            name: 'ARSY CORE',
            category: 'core',
            port: 4000,
            status: 'OFFLINE',
            latencyMs: 0,
            uptime: '0%',
            load: 'n/a',
          },
          {
            id: 'net',
            name: 'NET',
            category: 'network',
            port: 1812,
            status: 'WARNING',
            latencyMs: 200,
            uptime: '80%',
            load: 'high',
          },
        ],
      })
      const res = analyzeCopilot(snap, 'why is anything degraded or down?')
      assert.match(res.answer, /degraded/i)
      assert.ok(res.citations.some((c) => c.includes('ARSY CORE') && c.includes('OFFLINE')))
      assert.ok(res.suggestedActions.length >= 1)
      for (const a of res.suggestedActions) assert.equal(a.requiresConfirmation, true)
      assert.ok(res.suggestedActions.some((a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK'))
      assert.ok(res.suggestedActions.some((a) => a.actionId === 'CYCLE_SOCKET_CONNECTOR'))
    }
  )

  await t.test('diagnostics intent returns draft steps and confirmation-gated action', async () => {
    const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?diag=${Date.now()}`)
    const res = analyzeCopilot(
      baseSnapshot({ probe: { status: 'OFFLINE', latencyMs: 0, target: 'x' } }),
      'what diagnostics should I run next?'
    )
    assert.match(res.answer, /draft|diagnostic/i)
    assert.ok(
      res.suggestedActions.some(
        (a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK' && a.requiresConfirmation === true
      )
    )
  })

  await t.test(
    'action intent drafts actions without execution; all suggestions gated/draft',
    async () => {
      const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?act=${Date.now()}`)
      // avoids degraded-intent keywords so routing reaches action drafting
      const res = analyzeCopilot(baseSnapshot(), 'dispatch action: flush cache and recycle socket')
      const ids = res.suggestedActions.map((a) => a.actionId)
      assert.ok(ids.includes('FLUSH_CONTAINER_CACHE'), `ids=${ids.join(',')}`)
      assert.ok(ids.includes('CYCLE_SOCKET_CONNECTOR'))
      for (const a of res.suggestedActions) {
        assert.equal(a.requiresConfirmation, true)
        assert.match(a.label, /Draft/i)
      }
      assert.match(res.disclaimer, /assistive|verify|approval/i)
    }
  )

  await t.test('no degraded nodes path reports normal operation', async () => {
    const { analyzeCopilot } = await import(`../src/lib/agiCopilot.ts?ok=${Date.now()}`)
    const res = analyzeCopilot(baseSnapshot(), 'explain degraded nodes')
    assert.match(res.answer, /no degraded|normal/i)
    assert.deepEqual(res.suggestedActions, [])
  })
})
