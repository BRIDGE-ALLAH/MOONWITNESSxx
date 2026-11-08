// Dual-key approval & Role-Based Access Control (RBAC) governance for Cockpit operations.
export type UserRole = 'viewer' | 'operator' | 'secops_lead'

export interface OperatorIdentity {
  id: string
  name: string
  role: UserRole
  keyFingerprint?: string
}

export interface DualKeyAuthorization {
  primaryOperator: OperatorIdentity
  secondaryApprover?: OperatorIdentity
  actionId: string
  environment: string
  timestamp: string
  reason: string
  dualKeyToken?: string
  authorized: boolean
  rejectionReason?: string
}

export function isActionCritical(actionId: string, environment: string): boolean {
  if (environment === 'production') return true
  const criticalActions = ['RESTART_ORCHESTRATOR', 'FLUSH_DATABASE_POOLS', 'FAILOVER_SECONDARY']
  return criticalActions.includes(actionId)
}

export function validateAuthorization(
  primary: OperatorIdentity,
  actionId: string,
  environment: string,
  secondary?: OperatorIdentity,
  secondaryKeyInput?: string
): DualKeyAuthorization {
  const isCritical = isActionCritical(actionId, environment)
  const now = new Date().toISOString()

  // Viewers cannot execute any operational action
  if (primary.role === 'viewer') {
    return {
      primaryOperator: primary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Role insufficient',
      authorized: false,
      rejectionReason: 'Role "viewer" has read-only access.',
    }
  }

  // Non-critical action in local/dev only requires operator role
  if (!isCritical) {
    return {
      primaryOperator: primary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Standard authorization granted',
      authorized: true,
    }
  }

  // Critical actions require dual-key approval with secops_lead
  if (!secondary) {
    return {
      primaryOperator: primary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Dual-key required for production/critical actions',
      authorized: false,
      rejectionReason: 'Secondary approval required from secops_lead.',
    }
  }

  if (secondary.id === primary.id) {
    return {
      primaryOperator: primary,
      secondaryApprover: secondary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Dual-key violation',
      authorized: false,
      rejectionReason: 'Secondary approver must be distinct from primary operator.',
    }
  }

  if (secondary.role !== 'secops_lead') {
    return {
      primaryOperator: primary,
      secondaryApprover: secondary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Secondary approver role insufficient',
      authorized: false,
      rejectionReason: 'Secondary approver must have role "secops_lead".',
    }
  }

  if (!secondaryKeyInput || secondaryKeyInput.trim().length < 6) {
    return {
      primaryOperator: primary,
      secondaryApprover: secondary,
      actionId,
      environment,
      timestamp: now,
      reason: 'Invalid dual-key signature',
      authorized: false,
      rejectionReason: 'Secondary key token must be at least 6 characters.',
    }
  }

  return {
    primaryOperator: primary,
    secondaryApprover: secondary,
    actionId,
    environment,
    timestamp: now,
    reason: 'Dual-key authorization verified',
    dualKeyToken: `DK-${Date.now().toString(36).toUpperCase()}-${secondaryKeyInput.trim().slice(-4)}`,
    authorized: true,
  }
}
