import { decisionGraphDemo } from '../decision-graph/demo-data'
import { scenarioBaseline, scenarioCases } from '../scenario-forge/demo-data'
import type { GovernanceGateInput } from '../uncertainty-gate/types'

export const governanceGraphDemo = decisionGraphDemo
export const replayBaselineDemo = scenarioBaseline
export const replayScenarioDemo = scenarioCases[1]
export const governanceGateDemo: GovernanceGateInput = {
  metrics: [
    { id: 'throughput', label: 'Weekly throughput', low: 105, base: 132, high: 150, unit: 'items', sourceQuality: 'verified' },
    { id: 'cycle-time', label: 'Average cycle time', low: 4, base: 4.5, high: 7, unit: 'days', sourceQuality: 'estimated' },
    { id: 'delivery-risk', label: 'Delivery risk', low: 0.08, base: 0.16, high: 0.42, unit: 'ratio', sourceQuality: 'estimated' },
  ],
  requiredEvidenceCount: 8,
  verifiedEvidenceCount: 5,
  staleEvidenceCount: 1,
  contradictionCount: 1,
  unresolvedAssumptionCount: 2,
}
