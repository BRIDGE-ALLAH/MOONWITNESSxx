import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeCapability } from '../src/runtime-contract/capability.ts'

const verifier = { verify: async (grant) => grant.signature === 'valid' }
const parent = {
  id: 'root', issuerId: 'system', subjectId: 'service-a', tenantId: 'tenant-a', purpose: 'invoice-review',
  actions: ['invoice:read', 'invoice:approve'], resources: ['invoice/*'],
  issuedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', signature: 'valid',
}
const child = {
  ...parent, id: 'child', issuerId: 'service-a', subjectId: 'agent-1',
  actions: ['invoice:read'], resources: ['invoice/123'],
  expiresAt: '2026-11-20T00:00:00Z',
}

test('allows only attenuated delegated capabilities', async () => {
  const result = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', now: '2026-11-08T00:00:00Z',
  }, [parent, child], verifier)
  assert.equal(result.allowed, true)
})

test('rejects delegated privilege escalation and forged signatures', async () => {
  const escalated = { ...child, actions: ['invoice:delete'] }
  const denied = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:delete',
    resource: 'invoice/123', purpose: 'invoice-review', now: '2026-11-08T00:00:00Z',
  }, [parent, escalated], verifier)
  assert.equal(denied.reasonCodes[0], 'delegation_action_escalation')
  const forged = await authorizeCapability({
    actorId: 'agent-1', tenantId: 'tenant-a', action: 'invoice:read',
    resource: 'invoice/123', purpose: 'invoice-review', now: '2026-11-08T00:00:00Z',
  }, [{ ...parent, signature: 'forged' }, child], verifier)
  assert.equal(forged.reasonCodes[0], 'capability_signature_invalid')
})
