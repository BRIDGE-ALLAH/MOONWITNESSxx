import test from 'node:test'
import assert from 'node:assert/strict'

function node(id, name, category, status, latencyMs, overrides = {}) {
  return {
    id,
    name,
    category,
    status,
    latencyMs,
    port: 4000,
    uptime: '99.99%',
    load: 'n/a',
    ...overrides,
  }
}

function probe(overrides = {}) {
  return {
    status: 'HEALTHY',
    latencyMs: 30,
    target: 'http://localhost:4000/health/live',
    ok: true,
    kind: 'http',
    ...overrides,
  }
}

function snapshot(overrides = {}) {
  return {
    timestamp: '2026-11-08T09:00:00Z',
    environment: 'local',
    targetHost: 'localhost:4000',
    source: 'frontend',
    probe: probe(),
    nodes: [],
    recentLogs: [],
    ...overrides,
  }
}

test('runbooks engine', async (t) => {
  const { generateRunbooks } = await import('../src/lib/runbooks.ts')

  await t.test(
    'degraded warning node yields warning recommendation with diagnostic draft',
    async () => {
      const snap = snapshot({
        nodes: [node('oracle', 'ORACLE PYTHON ENGINE', 'analytics', 'WARNING', 120)],
      })
      const recs = generateRunbooks(snap)
      assert.equal(recs.length, 1)
      const rec = recs[0]
      assert.equal(rec.id, 'runbook-degraded-nodes')
      assert.equal(rec.severity, 'warning')
      assert.ok(rec.observed.includes('WARNING'))
      assert.ok(rec.citations.some((c) => c.includes('ORACLE PYTHON ENGINE')))
      assert.equal(rec.draftActions.length, 1)
      assert.equal(rec.draftActions[0].actionId, 'DIAGNOSTIC_HEALTH_CHECK')
      assert.equal(rec.draftActions[0].requiresConfirmation, true)
      assert.equal(rec.draftActions[0].execution, 'read-only-tauri')
    }
  )

  await t.test('offline node yields critical recommendation with diagnostic draft', async () => {
    const snap = snapshot({
      source: 'backend',
      probe: probe({ status: 'OFFLINE', ok: false }),
      nodes: [node('postgres', 'POSTGRESQL PRIMARY CLUSTER', 'database', 'OFFLINE', 0)],
    })
    const recs = generateRunbooks(snap)
    const critical = recs.find((r) => r.severity === 'critical')
    assert.ok(critical, 'expected a critical recommendation')
    assert.ok(critical.observed.includes('unreachable') || critical.observed.includes('OFFLINE'))
    assert.ok(critical.draftActions.some((a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK'))
    assert.ok(critical.citations.some((c) => c.includes('Probe target=')))
  })

  await t.test(
    'TCP probe unavailable in web is info, not an outage, and urges desktop/Tauri',
    async () => {
      const snap = snapshot({
        source: 'frontend',
        probe: probe({
          kind: 'tcp',
          status: 'OFFLINE',
          ok: false,
          target: 'localhost:5432',
          error: 'tcp probe unavailable in web',
        }),
        nodes: [
          node('postgres', 'POSTGRESQL PRIMARY CLUSTER', 'database', 'OFFLINE', 0, {
            probe: {
              kind: 'tcp',
              status: 'OFFLINE',
              ok: false,
              error: 'tcp probe unavailable in web',
            },
          }),
        ],
      })
      const recs = generateRunbooks(snap)
      const tcp = recs.find((r) => r.id === 'runbook-tcp-probe-unavailable-web')
      assert.ok(tcp, 'expected tcp-probe-unavailable recommendation')
      assert.equal(tcp.severity, 'info')
      assert.ok(tcp.observed.includes('not a confirmed outage'))
      assert.ok(tcp.observed.includes('web frontend'))
      assert.ok(tcp.nextSteps.some((s) => /desktop\/Tauri/.test(s)))
      assert.ok(tcp.draftActions.some((a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK'))
      // Must not emit a separate "nodes not healthy / critical" outage claim for the same limitation.
      assert.ok(!recs.some((r) => r.id === 'runbook-degraded-nodes' && r.severity === 'critical'))
    }
  )

  await t.test('same TCP offline probe in Tauri/backend is a real outage (critical)', async () => {
    const snap = snapshot({
      source: 'backend',
      probe: probe({ kind: 'tcp', status: 'OFFLINE', ok: false, error: 'connection refused' }),
      nodes: [node('radius', 'ATLAS FREERADIUS RUNTIME', 'network', 'OFFLINE', 0)],
    })
    const recs = generateRunbooks(snap)
    assert.ok(!recs.some((r) => r.id === 'runbook-tcp-probe-unavailable-web'))
    assert.ok(recs.some((r) => r.severity === 'critical'))
  })

  await t.test('all healthy yields info with no draft actions', async () => {
    const snap = snapshot({
      nodes: [node('arsy', 'ARSY CORE ORCHESTRATOR', 'core', 'HEALTHY', 30)],
    })
    const recs = generateRunbooks(snap)
    assert.equal(recs.length, 1)
    assert.equal(recs[0].id, 'runbook-all-healthy')
    assert.equal(recs[0].severity, 'info')
    assert.equal(recs[0].draftActions.length, 0)
  })

  await t.test('elevated latency yields info recommendation with diagnostic draft', async () => {
    const snap = snapshot({
      nodes: [node('oracle', 'ORACLE PYTHON ENGINE', 'analytics', 'HEALTHY', 350)],
    })
    const recs = generateRunbooks(snap)
    const latency = recs.find((r) => r.id === 'runbook-elevated-latency')
    assert.ok(latency)
    assert.equal(latency.severity, 'info')
    assert.ok(latency.draftActions.some((a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK'))
  })

  await t.test(
    'network-category degraded node includes privileged socket-recycle draft',
    async () => {
      const snap = snapshot({
        nodes: [node('radius', 'ATLAS FREERADIUS RUNTIME', 'network', 'WARNING', 80)],
      })
      const recs = generateRunbooks(snap)
      const degraded = recs.find((r) => r.id === 'runbook-degraded-nodes')
      assert.ok(degraded)
      assert.ok(
        degraded.draftActions.some((a) => a.actionId === 'CYCLE_SOCKET_CONNECTOR'),
        'expected CYCLE_SOCKET_CONNECTOR draft for network node'
      )
      const socket = degraded.draftActions.find((a) => a.actionId === 'CYCLE_SOCKET_CONNECTOR')
      assert.equal(socket.execution, 'intent-only')
      assert.equal(socket.requiresConfirmation, true)
    }
  )

  await t.test('omitting privileged drafts excludes socket recycle', async () => {
    const snap = snapshot({
      nodes: [node('radius', 'ATLAS FREERADIUS RUNTIME', 'network', 'WARNING', 80)],
    })
    const recs = generateRunbooks(snap, { includePrivilegedDrafts: false })
    const degraded = recs.find((r) => r.id === 'runbook-degraded-nodes')
    assert.ok(degraded)
    assert.ok(!degraded.draftActions.some((a) => a.actionId === 'CYCLE_SOCKET_CONNECTOR'))
    assert.ok(degraded.draftActions.some((a) => a.actionId === 'DIAGNOSTIC_HEALTH_CHECK'))
  })

  await t.test('limit option caps recommendations', async () => {
    const snap = snapshot({
      source: 'backend',
      probe: probe({ status: 'OFFLINE', ok: false }),
      nodes: [
        node('postgres', 'POSTGRESQL PRIMARY CLUSTER', 'database', 'OFFLINE', 0),
        node('oracle', 'ORACLE PYTHON ENGINE', 'analytics', 'WARNING', 350),
      ],
    })
    const recs = generateRunbooks(snap, { limit: 1 })
    assert.equal(recs.length, 1)
  })

  await t.test(
    'every draft action uses an existing ActionId and requires confirmation',
    async () => {
      const snap = snapshot({
        nodes: [
          node('postgres', 'POSTGRESQL PRIMARY CLUSTER', 'database', 'OFFLINE', 0),
          node('radius', 'ATLAS FREERADIUS RUNTIME', 'network', 'WARNING', 80),
        ],
      })
      const recs = generateRunbooks(snap)
      const validIds = new Set([
        'DIAGNOSTIC_HEALTH_CHECK',
        'FLUSH_CONTAINER_CACHE',
        'CYCLE_SOCKET_CONNECTOR',
        'EMERGENCY_DEGRADE_SYSTEM',
      ])
      for (const rec of recs) {
        for (const action of rec.draftActions) {
          assert.ok(validIds.has(action.actionId), `${action.actionId} is not a known ActionId`)
          assert.equal(action.requiresConfirmation, true)
          assert.ok(action.label)
          assert.ok(action.note)
        }
      }
    }
  )

  await t.test('empty snapshot yields all-healthy recommendation', async () => {
    const recs = generateRunbooks(snapshot())
    assert.equal(recs.length, 1)
    assert.equal(recs[0].id, 'runbook-all-healthy')
    assert.equal(recs[0].draftActions.length, 0)
  })
})
