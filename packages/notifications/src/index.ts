import { z } from 'zod'

// Notification types
export type NotificationType = 'toast' | 'email' | 'push' | 'sms'

// Notification severity
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

// Notification payload
export type NotificationPayload = {
  id: string
  title: string
  message: string
  type: NotificationType
  severity: NotificationSeverity
  timestamp: Date
  prototype: boolean // Clearly labeled prototype notification
  action?: {
    label: string
    action: () => void
  }
}

// RIOTWORKS-style toast notification
export const RIOTWORKS_TOASTS = {
  UPLOAD_STARTED: {
    id: 'upload_started',
    title: 'Product Upload Started',
    message: 'Your product upload has begun. Track progress in the ARSY DECK.',
    type: 'toast' as const,
    severity: 'info' as const,
    prototype: true,
  },
  UPLOAD_COMPLETED: {
    id: 'upload_completed',
    title: 'Product Upload Completed',
    message: 'Your product has been uploaded successfully.',
    type: 'toast' as const,
    severity: 'success' as const,
    prototype: true,
  },
  POLICY_BLOCKED: {
    id: 'policy_blocked',
    title: 'Policy Blocked',
    message: 'This content was blocked by ZILL integrity checks.',
    type: 'toast' as const,
    severity: 'error' as const,
    prototype: true,
  },
  RESEARCH_NEW_OPPORTUNITY: {
    id: 'research_new_opportunity',
    title: 'New Opportunity Discovered',
    message: 'A new market opportunity has been identified in the Signal Room.',
    type: 'toast' as const,
    severity: 'info' as const,
    prototype: true,
  },
} as const

export type { NotificationType, NotificationSeverity, NotificationPayload }
export { RIOTWORKS_TOASTS }
