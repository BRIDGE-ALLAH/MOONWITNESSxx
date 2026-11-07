import { z } from 'zod'

// Feature flag types
export type FeatureFlag = {
  id: string
  name: string
  description: string
  enabled: boolean
  environment: 'development' | 'staging' | 'production'
  prototypeOnly: boolean // Hanya aktif di prototype/demo
  expiryDate?: string // Optional expiry
  replacedBy?: string // Flag yang menggantikan flag ini
}

// Prototype-specific flags
export const PROTOTYPE_FLAGS = {
  PROTOTYPE_DATA_ONLY: {
    id: 'prototype_data_only',
    name: 'Prototype Data Only',
    description: 'Show clearly labeled demo/synthetic data',
    enabled: true,
    environment: 'development' as const,
    prototypeOnly: true,
    expiryDate: undefined,
  },
  REAL_MARKETPLACE_CONNECTIONS: {
    id: 'real_marketplace_connections',
    name: 'Real Marketplace Connections',
    description: 'Show real marketplace integration status',
    enabled: false,
    environment: 'development' as const,
    prototypeOnly: true,
    expiryDate: undefined,
  },
  BULLMQ_QUEUE_PROCESSING: {
    id: 'bullmq_queue_processing',
    name: 'BullMQ Queue Processing',
    description: 'Enable background job processing',
    enabled: false,
    environment: 'development' as const,
    prototypeOnly: false,
    expiryDate: undefined,
  },
  ZILL_POLICY_CHECKS: {
    id: 'zill_policy_checks',
    name: 'ZILL Policy Checks',
    description: 'Enable IP/licensing/similarity policy checks',
    enabled: true,
    environment: 'development' as const,
    prototypeOnly: false,
    expiryDate: undefined,
  },
} as const

export type { FeatureFlag }
export { PROTOTYPE_FLAGS }