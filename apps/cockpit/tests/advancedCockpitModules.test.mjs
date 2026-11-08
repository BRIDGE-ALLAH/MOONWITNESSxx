import test from 'node:test'
import assert from 'node:assert/strict'
import { probeGateDaemon, dispatchGateCommand } from '../src/lib/gateInterop.ts'
import { isActionCritical, validateAuthorization } from '../src/lib/dualKeyAuth.ts'
import { STANDARD_PLAYBOOKS, executePlaybookPipeline } from '../src/lib/playbookPipeline.ts'

test('Gate daemon interop module', async (t) => {
  await t.test('probeGateDaemon returns safe fallback outside running daemon', async () => {
    const res = await probeGateDaemon(49999)
    assert.ok(res.endpoint.includes('49999'))
    assert.ok(res.latencyMs >= 0)
    assert.equal(res.online, false)
  })

  await t.test('dispatchGateCommand returns formatted execution outcome', async () => {
    const res = await dispatchGateCommand({ command: 'reload_routes' })
    assert.equal(res.success, true)
    assert.equal(res.command, 'reload_routes')
    assert.ok(res.output.includes('RELOAD_ROUTES'))
    assert.ok(res.executedAt)
  })
})

test('Dual-key & RBAC authorization', async (t) => {
  const viewer = { id: 'usr-1', name: 'Auditor', role: 'viewer' }
  const operator = { id: 'usr-2', name: 'Ops Eng', role: 'operator' }
  const secops = { id: 'usr-3', name: 'Sec Lead', role: 'secops_lead' }

  await t.test('viewer role is rejected from operational actions', () => {
    const res = validateAuthorization(viewer, 'DIAGNOSTIC_HEALTH_CHECK', 'local')
    assert.equal(res.authorized, false)
    assert.match(res.rejectionReason ?? '', /read-only/)
  })

  await t.test('non-critical action in local environment passes with single operator', () => {
    const res = validateAuthorization(operator, 'DIAGNOSTIC_HEALTH_CHECK', 'local')
    assert.equal(res.authorized, true)
  })

  await t.test('production action requires secondary approver', () => {
    const res = validateAuthorization(operator, 'DIAGNOSTIC_HEALTH_CHECK', 'production')
    assert.equal(res.authorized, false)
    assert.match(res.rejectionReason ?? '', /Secondary approval required/)
  })

  await t.test('production action with invalid secondary key is rejected', () => {
    const res = validateAuthorization(
      operator,
      'DIAGNOSTIC_HEALTH_CHECK',
      'production',
      secops,
      '123'
    )
    assert.equal(res.authorized, false)
    assert.match(res.rejectionReason ?? '', /at least 6 characters/)
  })

  await t.test('production action with self-approval is rejected', () => {
    const res = validateAuthorization(
      secops,
      'DIAGNOSTIC_HEALTH_CHECK',
      'production',
      secops,
      'SEC-KEY-9999'
    )
    assert.equal(res.authorized, false)
    assert.match(res.rejectionReason ?? '', /must be distinct/)
  })

  await t.test('production action with valid dual-key generates approval token', () => {
    const res = validateAuthorization(
      operator,
      'DIAGNOSTIC_HEALTH_CHECK',
      'production',
      secops,
      'SEC-KEY-8888'
    )
    assert.equal(res.authorized, true)
    assert.ok(res.dualKeyToken?.startsWith('DK-'))
  })
})

test('Playbook execution pipeline', async (t) => {
  const pb = STANDARD_PLAYBOOKS[0]
  assert.ok(pb.steps.length >= 2)

  await t.test('dry-run execution validates all steps without mutation', async () => {
    const res = await executePlaybookPipeline(pb, { dryRun: true })
    assert.equal(res.success, true)
    assert.equal(res.dryRun, true)
    assert.equal(res.executedSteps.length, pb.steps.length)
    assert.ok(res.executedSteps[0].output.includes('[DRY-RUN]'))
  })

  await t.test('live simulation step completes cleanly', async () => {
    const res = await executePlaybookPipeline(pb, { dryRun: false })
    assert.equal(res.success, true)
    assert.equal(res.rollbackTriggered, false)
    assert.ok(res.totalDurationMs >= 0)
  })
})
