import assert from 'node:assert/strict'
import test from 'node:test'
import { assessEvidenceTrust, assessClaimCorroboration, ContaminationIndex } from '../src/knowledge/provenance.ts'

const good = {
  authenticity: 0.95, authority: 0.8, freshness: 0.9, contextCompleteness: 0.95,
  independenceGroup: 'publisher-a', signatureStatus: 'verified', provenanceComplete: true,
}

test('quarantines invalid provenance and signatures', () => {
  assert.equal(assessEvidenceTrust({ ...good, signatureStatus: 'invalid' }).disposition, 'quarantine')
  assert.equal(assessEvidenceTrust({ ...good, provenanceComplete: false }).disposition, 'quarantine')
})

test('keeps weak freshness in review rather than silently promoting', () => {
  const result = assessEvidenceTrust({ ...good, freshness: 0.1 })
  assert.equal(result.disposition, 'review')
  assert.ok(result.reasonCodes.includes('evidence_stale'))
})

test('counts independent origins, not duplicate mirrors', () => {
  const result = assessClaimCorroboration([
    { evidenceId: 'a', independenceGroup: 'same-origin', disposition: 'accept' },
    { evidenceId: 'b', independenceGroup: 'same-origin', disposition: 'accept' },
  ])
  assert.equal(result.promotable, false)
  assert.equal(result.independentSourceCount, 1)
})

test('quarantine returns dependent claims and decisions', () => {
  const index = new ContaminationIndex()
  index.linkEvidence({ sourceId: 'source-1', evidenceId: 'evidence-1', claimId: 'claim-1', decisionIds: ['decision-1'] })
  const result = index.quarantineSource('source-1')
  assert.deepEqual(result.affectedClaimIds, ['claim-1'])
  assert.deepEqual(result.frozenDecisionIds, ['decision-1'])
  assert.equal(index.isQuarantined('source-1'), true)
})
