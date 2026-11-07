import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateCompletion } from '../src/verification/completion.ts'
const contract = { id: 'release-check', version: '1', checks: [{ id: 'artifact' }, { id: 'tests' }] }
const proof = (checkId, status = 'PASS') => ({ checkId, status, verifierId: 'independent-ci', observedAt: '2026-11-08T00:00:00Z', evidenceRefs: ['artifact:' + checkId] })
test('completion requires independent evidence for every required check', () => {
  const result = evaluateCompletion(contract, 'release-agent', [proof('artifact'), proof('tests')])
  assert.equal(result.status, 'PASS')
  assert.equal(result.completionAllowed, true)
})
test('self-verification and missing checks remain unverified', () => {
  const result = evaluateCompletion(contract, 'release-agent', [{ ...proof('artifact'), verifierId: 'release-agent' }])
  assert.equal(result.status, 'UNVERIFIED')
  assert.equal(result.completionAllowed, false)
  assert.ok(result.checks[0].reasonCodes.includes('self_verification_not_independent'))
})
test('a failed independent check blocks completion', () => {
  const result = evaluateCompletion(contract, 'release-agent', [proof('artifact', 'FAIL'), proof('tests')])
  assert.equal(result.status, 'FAIL')
  assert.equal(result.completionAllowed, false)
})
test('rejects duplicate contract check identifiers', () => {
  assert.throws(() => evaluateCompletion({ ...contract, checks: [{ id: 'x' }, { id: 'x' }] }, 'agent', []), /Duplicate/)
})

test('rejects contracts with no required checks', () => {
  assert.throws(() => evaluateCompletion({ ...contract, checks: [{ id: 'optional', required: false }] }, 'agent', []), /at least one required check/)
})
test('rejects invalid runtime verification states without passing', () => {
  const result = evaluateCompletion(contract, 'agent', [{ ...proof('artifact'), status: 'MAYBE' }, proof('tests')])
  assert.equal(result.status, 'UNVERIFIED')
})
