import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeCapability } from '../src/runtime-contract/capability.ts'

const verifier = { verify: async (grant) => grant.signature === 'valid' }
const parent = {
  id: 'root', issuerId: 'system', subjectId: 'service-a', tenantId: 'tenant-a', purpose: 'invoice-review', sessionId: 'session-1',
  actions: ['invoice:read', 'invoice:approve'], resources: ['invoice/*'], argumentHashes: ['*'],
  issuedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', signature: 'valid',
}
const child = {
  ...parent, id: 'child', issuerId: 'service-a', subjectId: 'agent-1',
  actions: ['invoice:read'], resources: ['invoice/123'], argumentHashes: ['sha256:invoice-123-read'],
  expiresAt: '2026-11-20T00:00:00Z',
}

test('allows only attenuated delegated capabilities', async () => {
  const result = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1', argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [parent, child], verifier)
  assert.equal(result.allowed, true)
})

test('rejects delegated privilege escalation and forged signatures', async () => {
  const escalated = { ...child, actions: ['invoice:delete'] }
  const denied = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:delete',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1', argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [parent, escalated], verifier)
  assert.equal(denied.reasonCodes[0], 'delegation_action_escalation')
  const forged = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1', argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [{ ...parent, signature: 'forged' }, child], verifier)
  assert.equal(forged.reasonCodes[0], 'capability_signature_invalid')
})

test('rejects a child grant that outlives its parent or changes tenant', async () => {
  const expiredDelegation = { ...child, expiresAt: '2026-12-15T00:00:00Z' }
  const result = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1', argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [parent, expiredDelegation], verifier)
  assert.equal(result.reasonCodes[0], 'delegation_lifetime_escalation')
  const tenantEscalation = { ...child, tenantId: 'tenant-b' }
  const tenantResult = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-b', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1', argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [parent, tenantEscalation], verifier)
  assert.equal(tenantResult.reasonCodes[0], 'delegation_context_escalation')
})

test('binds a capability to its task session and normalized argument hash', async () => {
  const wrongSession = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'another-session',
    argumentHash: 'sha256:invoice-123-read', now: '2026-11-08T00:00:00Z',
  }, [parent, child], verifier)
  assert.equal(wrongSession.reasonCodes[0], 'capability_context_mismatch')
  const wrongArgs = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', sessionId: 'session-1',
    argumentHash: 'sha256:invoice-999-read', now: '2026-11-08T00:00:00Z',
  }, [parent, child], verifier)
  assert.equal(wrongArgs.reasonCodes[0], 'arguments_outside_capability')
})
