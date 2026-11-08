import assert from 'node:assert/strict'
import test from 'node:test'
import { RevocationPropagationGraph } from '../src/knowledge/revocation.ts'
import { composeDerivedLineage, evaluateLineageAccess } from '../src/knowledge/lineage-access.ts'
import { MEMORY_INTEGRITY_ATTACKS, scoreMemoryIntegrityBenchmark } from '../src/evaluation/memory-integrity.ts'

test('revocation propagates through evidence, claim, memory, summary, cache and freezes decisions/actions', () => {
  const graph = new RevocationPropagationGraph()
  for (const [id, kind] of [['source:1','source'],['evidence:1','evidence'],['claim:1','claim'],['memory:1','memory'],['summary:1','summary'],['cache:1','cache'],['decision:1','decision'],['action:1','action']]) graph.registerNode({ id, kind, tenantId: 'tenant:a' })
  for (const [upstreamId, downstreamId] of [['source:1','evidence:1'],['evidence:1','claim:1'],['claim:1','memory:1'],['memory:1','summary:1'],['summary:1','cache:1'],['claim:1','decision:1'],['decision:1','action:1']]) graph.addDependency({ upstreamId, downstreamId })
  const request = { revocationId: 'revoke:1', sourceId: 'source:1', actorId: 'zill:reviewer', reason: 'source withdrawn', occurredAt: '2026-11-08T00:00:00.000Z' }
  const impact = graph.revoke(request)
  assert.deepEqual(impact.revokedClaimIds, ['claim:1'])
  assert.deepEqual(impact.invalidatedMemoryIds, ['memory:1'])
  assert.deepEqual(impact.frozenActionIds, ['action:1'])
  assert.equal(graph.canServe('cache:1'), false)
  assert.deepEqual(graph.revoke(request), impact)
  assert.throws(() => graph.revoke({ ...request, reason: 'different reason' }), /revocation id collision/)
})

test('revocation graph rejects cross-tenant edges and unknown references', () => {
  const graph = new RevocationPropagationGraph()
  graph.registerNode({ id: 'a', kind: 'source', tenantId: 'a' })
  graph.registerNode({ id: 'b', kind: 'claim', tenantId: 'b' })
  assert.throws(() => graph.addDependency({ upstreamId: 'a', downstreamId: 'b' }), /cross-tenant/)
})

test('rebuilding a revoked node requires fresh evidence and an explicit actor', () => {
  const graph = new RevocationPropagationGraph()
  graph.registerNode({ id: 'claim:1', kind: 'claim', tenantId: 't' })
  graph.revoke({ revocationId: 'r1', sourceId: 'claim:1', actorId: 'reviewer', reason: 'withdrawn', occurredAt: '2026-11-08T00:00:00Z' })
  assert.throws(() => graph.rebuildNode('claim:1', [], 'reviewer', () => true), /fresh evidence/)
  assert.throws(() => graph.rebuildNode('claim:1', ['evidence:new'], 'reviewer', () => false), /verification failed/)
  graph.rebuildNode('claim:1', ['evidence:new'], 'reviewer', () => true)
  assert.equal(graph.canServe('claim:1'), true)
})

test('derived artifact access is denied if any contributing field is unauthorized', () => {
  const lineage = { artifactId: 'cache:aggregate', tenantId: 'tenant:a', lineageComplete: true, sourceFields: [
    { sourceId: 'crm', fieldPath: 'customer.name', tenantId: 'tenant:a', classification: 'internal' },
    { sourceId: 'payroll', fieldPath: 'salary', tenantId: 'tenant:a', classification: 'restricted' }
  ] }
  const decision = evaluateLineageAccess(lineage, { requesterId: 'agent:analyst', tenantId: 'tenant:a', allowedClassifications: ['public','internal'] })
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasonCodes.includes('classification_not_authorized'))
  assert.equal(decision.deniedSourceFields[0].sourceId, 'payroll')
})

test('lineage composition preserves source fields and fails closed on incomplete parents', () => {
  const parent = { artifactId: 'derived:1', tenantId: 'tenant:a', lineageComplete: true, sourceFields: [
    { sourceId: 'db', fieldPath: 'table.secret', tenantId: 'tenant:a', classification: 'restricted' }
  ] }
  const composed = composeDerivedLineage('summary:1', 'tenant:a', [parent, parent])
  assert.equal(composed.sourceFields.length, 1)
  assert.equal(composed.sourceFields[0].classification, 'restricted')
  assert.equal(evaluateLineageAccess(composed, { requesterId: 'agent', tenantId: 'tenant:a', allowedClassifications: ['public'] }).allowed, false)
})

test('memory integrity benchmark covers ten attack classes and scores read-time blocking highest', () => {
  assert.equal(MEMORY_INTEGRITY_ATTACKS.length, 10)
  const trials = [
    ...MEMORY_INTEGRITY_ATTACKS.map((attack, index) => ({ caseId: 'attack-' + index, attackId: attack.id, attacked: true, served: index === 0, detectedAt: index === 0 ? 'audit' : 'read' })),
    { caseId: 'control-1', attackId: 'control_pristine', attacked: false, served: true, detectedAt: 'none' }
  ]
  const report = scoreMemoryIntegrityBenchmark(trials)
  assert.equal(report.blockedAtRead, 9)
  assert.equal(report.detectedOnlyAtAudit, 1)
  assert.equal(report.falseAlarms, 0)
  assert.equal(report.score, 10.5 / 11)
})

test('memory integrity metric counts blocked and served attacks detected only at audit', () => {
  const report = scoreMemoryIntegrityBenchmark([
    { caseId: 'blocked-late', attackId: 'content_mutation', attacked: true, served: false, detectedAt: 'audit' },
    { caseId: 'served-late', attackId: 'record_deletion', attacked: true, served: true, detectedAt: 'audit' },
  ])
  assert.equal(report.detectedOnlyAtAudit, 2)
  assert.equal(report.blockedAtRead, 0)
})

test('benchmark rejects duplicate trial IDs and inconsistent control labels', () => {
  assert.throws(() => scoreMemoryIntegrityBenchmark([
    { caseId: 'same', attackId: 'content_mutation', attacked: true, served: false, detectedAt: 'read' },
    { caseId: 'same', attackId: 'record_deletion', attacked: true, served: false, detectedAt: 'read' }
  ]), /unique/)
  assert.throws(() => scoreMemoryIntegrityBenchmark([
    { caseId: 'bad-control', attackId: 'control_pristine', attacked: true, served: false, detectedAt: 'read' }
  ]), /disagree/)
})


test('lineage composition keeps the most restrictive classification for duplicate source fields', () => {
  const publicParent = { artifactId: 'p1', tenantId: 'tenant:a', lineageComplete: true, sourceFields: [
    { sourceId: 'db', fieldPath: 'customer.secret', tenantId: 'tenant:a', classification: 'public' }
  ] }
  const restrictedParent = { artifactId: 'p2', tenantId: 'tenant:a', lineageComplete: true, sourceFields: [
    { sourceId: 'db', fieldPath: 'customer.secret', tenantId: 'tenant:a', classification: 'restricted' }
  ] }
  const composed = composeDerivedLineage('joined', 'tenant:a', [restrictedParent, publicParent])
  assert.equal(composed.sourceFields.length, 1)
  assert.equal(composed.sourceFields[0].classification, 'restricted')
  assert.equal(evaluateLineageAccess(composed, { requesterId: 'reader', tenantId: 'tenant:a', allowedClassifications: ['public', 'internal'] }).allowed, false)
  assert.throws(() => composeDerivedLineage('cross', 'tenant:a', [{ ...restrictedParent, sourceFields: [{ ...restrictedParent.sourceFields[0], tenantId: 'tenant:b' }] }]), /cross-tenant source lineage/)
})

test('revocation propagation paths are deterministic regardless of edge insertion order', () => {
  const graph = new RevocationPropagationGraph()
  for (const [id, kind] of [['root','source'],['a','claim'],['b','claim'],['leaf','memory']]) graph.registerNode({ id, kind, tenantId: 't' })
  graph.addDependency({ upstreamId: 'root', downstreamId: 'b' })
  graph.addDependency({ upstreamId: 'root', downstreamId: 'a' })
  graph.addDependency({ upstreamId: 'a', downstreamId: 'leaf' })
  graph.addDependency({ upstreamId: 'b', downstreamId: 'leaf' })
  const impact = graph.revoke({ revocationId: 'r', sourceId: 'root', actorId: 'reviewer', reason: 'withdrawn', occurredAt: '2026-11-08T00:00:00Z' })
  assert.deepEqual(impact.propagationPaths.leaf, ['root', 'a', 'leaf'])
})

test('memory integrity report counts blocked attacks with no detection signal separately', () => {
  const report = scoreMemoryIntegrityBenchmark([
    { caseId: 'blocked-unattributed', attackId: 'content_mutation', attacked: true, served: false, detectedAt: 'none' },
    { caseId: 'served-undetected', attackId: 'record_deletion', attacked: true, served: true, detectedAt: 'none' },
  ])
  assert.equal(report.blockedWithoutSignal, 1)
  assert.equal(report.undetectedAttacks, 1)
})

test('lineage access fails closed on malformed source-field classification', () => {
  const lineage = { artifactId: 'bad', tenantId: 'tenant:a', lineageComplete: true, sourceFields: [
    { sourceId: 'db', fieldPath: 'secret', tenantId: 'tenant:a', classification: 'unknown' }
  ] }
  const decision = evaluateLineageAccess(lineage, { requesterId: 'reader', tenantId: 'tenant:a', allowedClassifications: ['public', 'internal', 'confidential', 'restricted'] })
  assert.equal(decision.allowed, false)
  assert.ok(decision.reasonCodes.includes('source_field_metadata_invalid'))
  assert.throws(() => composeDerivedLineage('bad', 'tenant:a', [lineage]), /invalid source field lineage metadata/)
})
