import test from 'node:test'
import assert from 'node:assert/strict'
import { authorizeAndRecordDeploymentAction } from '../src/deployments/authorization.ts'

class FakePool {
  records = []
  async query(statement, values) {
    assert.match(statement, /INSERT INTO arsy_deployment_authorization_decisions/)
    this.records.push(values)
    return { rows: [{ id: 'decision-1', recorded_at: '2026-11-08T00:00:00.000Z' }] }
  }
  async end() {}
}

const base = {
  principal: { kind: 'operator', operatorId: 'operator-1' },
  operationId: '11111111-1111-4111-8111-111111111111',
  deploymentId: '33333333-3333-4333-8333-333333333333',
  ownerId: 'operator-1',
  targetHostId: '22222222-2222-4222-8222-222222222222',
  action: 'deploy',
}

function provider(decision) {
  return { evaluate: async () => decision }
}

const allowed = {
  effect: 'allow',
  reasonCode: 'DEPLOYMENT_SCOPE_APPROVED',
  policyVersion: 'zill-deployment-v1',
  approvalRequired: false,
  approvalState: 'not_required',
}

test('deployment authorization denies missing principals and persists the denial', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, { ...base, principal: null }, provider(allowed))
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'AUTHENTICATION_REQUIRED')
  assert.equal(pool.records.length, 1)
  assert.equal(pool.records[0][7], 'deny')
  assert.equal(pool.records[0][4], 'unknown')
})

test('deployment authorization denies cross-owner principals before policy evaluation', async () => {
  const pool = new FakePool()
  let evaluations = 0
  const policy = { evaluate: async () => { evaluations += 1; return allowed } }
  const result = await authorizeAndRecordDeploymentAction(
    pool,
    { ...base, principal: { kind: 'operator', operatorId: 'other-owner' } },
    policy,
  )
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'OWNER_SCOPE_DENIED')
  assert.equal(evaluations, 0)
  assert.equal(pool.records[0][6], 'deny')
})

test('deployment authorization denies when the policy provider is unavailable', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, base)
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'POLICY_UNAVAILABLE')
  assert.equal(pool.records[0][6], 'deny')
})

test('deployment authorization allows only an explicit policy allow without unmet approval', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, base, provider(allowed))
  assert.equal(result.allowed, true)
  assert.equal(result.reasonCode, 'DEPLOYMENT_SCOPE_APPROVED')
  assert.equal(result.policyVersion, 'zill-deployment-v1')
  assert.equal(pool.records[0][6], 'allow')
  assert.equal(pool.records[0][9], 'zill-deployment-v1')
})

test('deployment authorization blocks high-risk actions without an approved reference', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, base, provider({
    ...allowed,
    approvalRequired: true,
    approvalState: 'pending',
    approvalReference: null,
  }))
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'APPROVAL_REQUIRED')
  assert.equal(pool.records[0][6], 'deny')
})

test('deployment authorization accepts high-risk action only with approved reference', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, base, provider({
    ...allowed,
    approvalRequired: true,
    approvalState: 'approved',
    approvalReference: 'approval-2026-001',
  }))
  assert.equal(result.allowed, true)
  assert.equal(result.approvalReference, 'approval-2026-001')
  assert.equal(pool.records[0][9], 'approval-2026-001')
})

test('deployment authorization times out policy evaluation and records a denial', async () => {
  const pool = new FakePool()
  let aborted = false
  const result = await authorizeAndRecordDeploymentAction(pool, base, {
    evaluate: async ({ signal }) => {
      signal.addEventListener('abort', () => { aborted = true }, { once: true })
      return await new Promise(() => {})
    },
  }, 5)
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'POLICY_TIMEOUT')
  assert.equal(aborted, true)
  assert.equal(pool.records[0][6], 'deny')
})

test('deployment authorization fails closed on policy exceptions and malformed decisions', async () => {
  const pool = new FakePool()
  const unavailable = await authorizeAndRecordDeploymentAction(pool, base, {
    evaluate: async () => { throw new Error('provider timeout') },
  })
  assert.equal(unavailable.allowed, false)
  assert.equal(unavailable.reasonCode, 'POLICY_UNAVAILABLE')

  const invalid = await authorizeAndRecordDeploymentAction(pool, base, provider({
    effect: 'allow',
    reasonCode: 'ALLOW',
    policyVersion: '',
    approvalRequired: false,
    approvalState: 'not_required',
  }))
  assert.equal(invalid.allowed, false)
  assert.equal(invalid.reasonCode, 'POLICY_CONTRACT_INVALID')
})

test('deployment authorization records unknown actions without normalizing them into a valid action', async () => {
  const pool = new FakePool()
  const result = await authorizeAndRecordDeploymentAction(pool, { ...base, action: 'delete-host' }, provider(allowed))
  assert.equal(result.allowed, false)
  assert.equal(result.reasonCode, 'INVALID_ACTION')
  assert.equal(pool.records[0][6], 'delete-host')
})

test('deployment authorization rejects secret-bearing evidence and fails before persistence', async () => {
  const pool = new FakePool()
  await assert.rejects(
    authorizeAndRecordDeploymentAction(pool, base, provider({
      ...allowed,
      evidence: { nested: { apiKey: 'must-not-persist' } },
    })),
    /secret-bearing fields/,
  )
  assert.equal(pool.records.length, 0)
})

test('deployment authorization never reports success when the decision cannot be persisted', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  await assert.rejects(authorizeAndRecordDeploymentAction(pool, base, provider(allowed)), /not persisted/)
})
