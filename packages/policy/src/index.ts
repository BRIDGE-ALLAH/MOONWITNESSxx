import { z } from 'zod'

// Policy rule types
export type PolicyRule = {
  id: string
  name: string
  description: string
  severity: 'PASS' | 'WARNING' | 'BLOCKED'
  condition: 'confidence' | 'similarity' | 'provenance' | 'technical' | 'licensing'
  threshold?: number
  message: string
  hardStop: boolean // Cannot be overridden by high score
}

// Policy gates configuration
export type PolicyGate = {
  id: string
  name: string
  rules: PolicyRule[]
  description: string
}

// ZILL Watch policy states
export const ZILL_POLICY_GATES = {
  IP_LICENSING: {
    id: 'ip-licensing',
    name: 'IP & Licensing Check',
    rules: [
      {
        id: 'ip-1',
        name: 'Source Provenance Check',
        severity: 'PASS' as const,
        condition: 'provenance',
        message: 'Source provenance verified',
        hardStop: false,
      },
      {
        id: 'ip-2',
        name: 'Licensing Disclosure',
        severity: 'PASS' as const,
        condition: 'licensing',
        message: 'Platform disclosures present',
        hardStop: false,
      },
    ],
    description: 'IP and licensing policy check for ZILL Watch',
  },
  SIMILARITY: {
    id: 'similarity',
    name: 'Similarity Check',
    rules: [
      {
        id: 'sim-1',
        name: 'Similarity Detection',
        severity: 'WARNING' as const,
        condition: 'similarity',
        message: 'Similar content detected below threshold',
        hardStop: false,
        threshold: 0.8,
      },
      {
        id: 'sim-2',
        name: 'High Similarity Block',
        severity: 'BLOCKED' as const,
        condition: 'similarity',
        message: 'High similarity content blocked',
        hardStop: true,
        threshold: 0.95,
      },
    ],
    description: 'Content similarity policy for ZILL Watch',
  },
  TECHNICAL_SPEC: {
    id: 'technical',
    name: 'Technical Specification Check',
    rules: [
      {
        id: 'tech-1',
        name: 'Metadata Completeness',
        severity: 'PASS' as const,
        condition: 'technical',
        message: 'All required metadata present',
        hardStop: false,
      },
    ],
    description: 'Technical specification policy check',
  },
} as const

export type { PolicyRule, PolicyGate }
export { ZILL_POLICY_GATES }