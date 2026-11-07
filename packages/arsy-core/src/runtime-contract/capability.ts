export interface CapabilityGrant {
  id: string
  issuerId: string
  subjectId: string
  tenantId: string
  purpose: string
  /** Bound to one orchestrated task/session; prevents cross-session warrant reuse. */
  sessionId: string
  actions: string[]
  resources: string[]
  /** Hashes of gateway-normalized arguments; '*' is allowed only when explicitly granted. */
  argumentHashes: string[]
  issuedAt: string
  expiresAt: string
  /** Signature over the canonical grant payload, verified by a trusted key registry. */
  signature: string
}

export interface CapabilityRequest {
  actorId: string
  tenantId: string
  action: string
  resource: string
  purpose: string
  sessionId: string
  /** SHA-256 of canonicalized arguments, computed by the trusted tool gateway. */
  argumentHash: string
  now?: string
}

export interface CapabilityVerifier {
  verify(grant: CapabilityGrant): Promise<boolean>
}

export interface CapabilityDecision {
  allowed: boolean
  reasonCodes: string[]
  grantId?: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidScopeList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isNonEmptyString(item)
    && (item === '*' || !item.includes('*') || item.endsWith('/*')))
}

function matchesScope(patterns: readonly string[], value: string): boolean {
  return patterns.some((pattern) => {
    if (pattern === '*') return true
    if (pattern.endsWith('/*')) return value.startsWith(pattern.slice(0, -1))
    return pattern === value
  })
}

/**
 * Verifies a root-to-leaf, attenuation-only delegation chain.
 * The model supplies a request, never the trust anchor or signature verifier.
 */
export async function authorizeCapability(
  request: CapabilityRequest,
  chain: readonly CapabilityGrant[],
  verifier: CapabilityVerifier,
): Promise<CapabilityDecision> {
  const deny = (reason: string): CapabilityDecision => ({ allowed: false, reasonCodes: [reason] })
  if (!chain.length) return deny('capability_chain_missing')
  if (![request.actorId, request.tenantId, request.action, request.resource, request.purpose, request.sessionId, request.argumentHash].every(isNonEmptyString)) {
    return deny('request_context_incomplete')
  }
  const now = Date.parse(request.now ?? new Date().toISOString())
  if (!Number.isFinite(now)) return deny('invalid_evaluation_time')

  const seen = new Set<string>()
  for (let index = 0; index < chain.length; index += 1) {
    const grant = chain[index]
    if (!isNonEmptyString(grant.id) || seen.has(grant.id)) return deny('capability_chain_cycle_or_duplicate')
    seen.add(grant.id)
    if (![grant.issuerId, grant.subjectId, grant.tenantId, grant.purpose, grant.sessionId, grant.issuedAt, grant.expiresAt, grant.signature].every(isNonEmptyString)
      || !isValidScopeList(grant.actions) || !isValidScopeList(grant.resources) || !isValidScopeList(grant.argumentHashes)) {
      return deny('capability_grant_invalid')
    }
    let signatureValid = false
    try { signatureValid = await verifier.verify(grant) } catch { return deny('capability_verifier_unavailable') }
    if (!signatureValid) return deny('capability_signature_invalid')
    const issuedAt = Date.parse(grant.issuedAt)
    const expiresAt = Date.parse(grant.expiresAt)
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > now || expiresAt <= now || expiresAt <= issuedAt) {
      return deny('capability_expired_or_not_yet_valid')
    }
    if (index > 0) {
      const parent = chain[index - 1]
      if (grant.issuerId !== parent.subjectId) return deny('delegation_issuer_mismatch')
      if (grant.tenantId !== parent.tenantId || grant.purpose !== parent.purpose || grant.sessionId !== parent.sessionId) return deny('delegation_context_escalation')
      if (Date.parse(grant.issuedAt) < Date.parse(parent.issuedAt)) return deny('delegation_issued_before_parent')
      if (Date.parse(grant.expiresAt) > Date.parse(parent.expiresAt)) return deny('delegation_lifetime_escalation')
      if (grant.actions.some((action) => !matchesScope(parent.actions, action))) return deny('delegation_action_escalation')
      if (grant.resources.some((resource) => !matchesScope(parent.resources, resource))) return deny('delegation_resource_escalation')
      if (grant.argumentHashes.some((hash) => !matchesScope(parent.argumentHashes, hash))) return deny('delegation_argument_escalation')
    }
  }

  const leaf = chain[chain.length - 1]
  if (leaf.subjectId !== request.actorId) return deny('capability_subject_mismatch')
  if (leaf.tenantId !== request.tenantId || leaf.purpose !== request.purpose || leaf.sessionId !== request.sessionId) return deny('capability_context_mismatch')
  if (!matchesScope(leaf.actions, request.action)) return deny('action_outside_capability')
  if (!matchesScope(leaf.resources, request.resource)) return deny('resource_outside_capability')
  if (!matchesScope(leaf.argumentHashes, request.argumentHash)) return deny('arguments_outside_capability')
  return { allowed: true, reasonCodes: [], grantId: leaf.id }
}
