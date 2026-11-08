import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ProbeTelemetrySchema,
  NodeTelemetrySchema,
  CockpitSnapshotSchema,
  OperatorActionSchema,
  ActionDispatchResultSchema,
  AuditEventSchema,
  UniverseExperienceSchema,
} from '../src/index.ts'

test('shared contract schema verification', async (t) => {
  await t.test('ProbeTelemetrySchema validates correct probe payload', () => {
    const valid = {
      status: 'ONLINE',
      latencyMs: 14.2,
      target: 'http://localhost:4000/health/live',
      ok: true,
      kind: 'http',
    }
    const result = ProbeTelemetrySchema.safeParse(valid)
    assert.equal(result.success, true)

    const invalid = {
      status: 'INVALID_STATUS',
      latencyMs: -5,
      target: '',
      ok: 'not-a-boolean',
    }
    assert.equal(ProbeTelemetrySchema.safeParse(invalid).success, false)
  })

  await t.test('NodeTelemetrySchema & CockpitSnapshotSchema validate cluster state', () => {
    const probe = {
      status: 'ONLINE',
      latencyMs: 10,
      target: 'http://localhost:4000',
      ok: true,
    }
    const node = {
      id: 'arsy',
      name: 'ARSY CORE',
      category: 'core',
      status: 'ONLINE',
      latencyMs: 12.5,
      probe,
      source: 'backend-probe',
      timestamp: new Date().toISOString(),
    }
    assert.equal(NodeTelemetrySchema.safeParse(node).success, true)

    const snapshot = {
      timestamp: new Date().toISOString(),
      environment: 'local',
      targetHost: '127.0.0.1',
      probe,
      nodes: [node],
      recentLogs: [],
      source: 'tauri-ipc',
    }
    assert.equal(CockpitSnapshotSchema.safeParse(snapshot).success, true)
  })

  await t.test('OperatorActionSchema & ActionDispatchResultSchema validate dispatch events', () => {
    const action = {
      id: 'restart-service',
      name: 'Restart Core Service',
      danger: true,
      requiresConfirmation: true,
      target: 'arsy',
      category: 'core',
    }
    assert.equal(OperatorActionSchema.safeParse(action).success, true)

    const result = {
      ok: true,
      actionId: 'restart-service',
      timestamp: new Date().toISOString(),
      message: 'Service restart initiated',
      actor: 'operator-noc',
      environment: 'local',
    }
    assert.equal(ActionDispatchResultSchema.safeParse(result).success, true)
  })

  await t.test('AuditEventSchema and UniverseExperienceSchema validate correctly', () => {
    const audit = {
      id: 'evt-123',
      ts: new Date().toISOString(),
      type: 'action.dispatch',
      actionId: 'flush-cache',
      actor: 'operator',
      result: 'success',
      environment: 'local',
    }
    assert.equal(AuditEventSchema.safeParse(audit).success, true)

    const universe = {
      id: 'gate',
      number: '01',
      name: 'GATE',
      classification: 'Core Application',
      role: 'Public entrance and orientation portal',
      status: 'active',
      statusLabel: 'Operational Portal',
      boundary: 'apps/gate — Public Gateway',
      href: 'http://localhost:3001',
    }
    assert.equal(UniverseExperienceSchema.safeParse(universe).success, true)
  })
})
