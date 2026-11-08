import test from 'node:test'
import assert from 'node:assert/strict'

const EVENTS = [
  {
    id: 'e1',
    ts: '2026-01-01T00:00:00Z',
    type: 'action-requested',
    actionId: 'DIAGNOSTIC_HEALTH_CHECK',
    source: 'operator',
    result: 'approved',
    environment: 'prod',
    correlationId: 'chain-alpha',
    actor: 'alice',
  },
  {
    id: 'e2',
    ts: '2026-01-01T00:00:01Z',
    type: 'action-confirmed',
    actionId: 'DIAGNOSTIC_HEALTH_CHECK',
    source: 'copilot-draft',
    result: 'executed',
    environment: 'prod',
    correlationId: 'chain-alpha',
  },
  {
    id: 'e3',
    ts: '2026-01-01T00:00:02Z',
    type: 'action-cancelled',
    actionId: 'EMERGENCY_DEGRADE_SYSTEM',
    source: 'operator',
    result: 'denied',
    environment: 'staging',
    correlationId: 'chain-beta',
    actor: 'bob',
  },
  {
    id: 'e4',
    ts: '2026-01-01T00:00:03Z',
    type: 'execution-marker',
    actionId: 'DIAGNOSTIC_HEALTH_CHECK',
    source: 'system',
    correlationId: 'chain-gamma',
    metadata: { note: 'intent only; no execution' },
  },
]

test('audit filters + jsonl export', async (t) => {
  const { filterAuditEvents, exportAuditJsonl } = await import(
    `../src/lib/audit.ts?filters=${Date.now()}`
  )

  await t.test('no filters returns all events in input order', () => {
    assert.deepEqual(filterAuditEvents(EVENTS, {}), EVENTS)
  })

  await t.test('type filter narrows results', () => {
    const out = filterAuditEvents(EVENTS, { type: 'action-requested' })
    assert.deepEqual(
      out.map((e) => e.id),
      ['e1']
    )
  })

  await t.test('correlationId filter isolates one chain exactly', () => {
    const out = filterAuditEvents(EVENTS, { correlationId: 'chain-alpha' })
    assert.deepEqual(
      out.map((e) => e.id),
      ['e1', 'e2']
    )
    assert.ok(out.every((e) => e.correlationId === 'chain-alpha'))
  })

  await t.test('unknown correlationId returns empty', () => {
    assert.deepEqual(filterAuditEvents(EVENTS, { correlationId: 'nope' }), [])
  })

  await t.test('free-text query matches correlation id and other fields', () => {
    assert.deepEqual(
      filterAuditEvents(EVENTS, { query: 'chain-beta' }).map((e) => e.id),
      ['e3']
    )
    assert.deepEqual(
      filterAuditEvents(EVENTS, { query: 'bob' }).map((e) => e.id),
      ['e3']
    )
    assert.deepEqual(
      filterAuditEvents(EVENTS, { query: 'intent only' }).map((e) => e.id),
      ['e4']
    )
    assert.deepEqual(
      filterAuditEvents(EVENTS, { query: 'DIAGNOSTIC' }).map((e) => e.id),
      ['e1', 'e2', 'e4']
    )
    // query is case-insensitive
    assert.deepEqual(
      filterAuditEvents(EVENTS, { query: 'prod' }).map((e) => e.id),
      ['e1', 'e2']
    )
  })

  await t.test('combined filters intersect', () => {
    const out = filterAuditEvents(EVENTS, {
      type: 'action-requested',
      source: 'operator',
      environment: 'prod',
    })
    assert.deepEqual(
      out.map((e) => e.id),
      ['e1']
    )
    const none = filterAuditEvents(EVENTS, { type: 'action-requested', source: 'system' })
    assert.deepEqual(none, [])
  })

  await t.test('export produces one JSON object per line', () => {
    const text = exportAuditJsonl([EVENTS[0], EVENTS[1]])
    const lines = text.split('\n')
    assert.equal(lines.length, 3) // two records + trailing newline
    assert.equal(lines[2], '')
    assert.deepEqual(JSON.parse(lines[0]), EVENTS[0])
    assert.deepEqual(JSON.parse(lines[1]), EVENTS[1])
  })

  await t.test('export of empty set is an empty file', () => {
    assert.equal(exportAuditJsonl([]), '')
  })

  await t.test('export does not mutate the input array', () => {
    const before = [...EVENTS]
    exportAuditJsonl(EVENTS)
    assert.deepEqual(EVENTS, before)
  })
})
