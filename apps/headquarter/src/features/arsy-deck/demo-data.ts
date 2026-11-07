import type { ArsyDeckSnapshot } from './types'

/**
 * Explicitly synthetic preview content.
 * Replace this repository with a typed ARSY public API adapter only after
 * ARSY publishes the workspace-pulse contract and authorization rules.
 */
export const ARSY_DECK_DEMO_SNAPSHOT: ArsyDeckSnapshot = {
  source: 'demo',
  disclosure: 'Illustrative sample only — not connected to ARSY, a marketplace, or a live workspace.',
  metrics: [
    { id: 'products', label: 'Products', value: '12', context: 'sample catalog count' },
    { id: 'pipeline', label: 'Pipeline', value: '24', context: 'sample work items' },
    { id: 'readiness', label: 'Marketplace readiness', value: '85%', context: 'illustrative score' },
    { id: 'receipts', label: 'Gross receipts', value: '$125,000', context: 'illustrative amount' },
    { id: 'contribution', label: 'Net contribution', value: '$89,000', context: 'illustrative amount' },
    { id: 'agents', label: 'Agent capacity', value: '5', context: 'sample agents' },
    { id: 'experiments', label: 'Experiments', value: '15', context: 'sample experiments' },
    { id: 'pulse', label: 'Workspace pulse', value: '92%', context: 'illustrative score' },
  ],
  opportunities: [
    { id: 'op-001', title: 'Regional market research', summary: 'Example opportunity awaiting evidence review', confidence: 85, stage: 'review' },
    { id: 'op-002', title: 'Digital product concept', summary: 'Example concept requiring discovery work', confidence: 72, stage: 'research' },
    { id: 'op-003', title: 'Channel capability review', summary: 'Example channel assessment with open dependencies', confidence: 68, stage: 'blocked' },
  ],
  agents: [
    { id: 'agent-scout', name: 'Scout', responsibility: 'Market discovery', state: 'sample-active' },
    { id: 'agent-maker', name: 'Maker', responsibility: 'Creative production', state: 'sample-active' },
    { id: 'agent-keeper', name: 'Keeper', responsibility: 'Asset stewardship', state: 'sample-idle' },
    { id: 'agent-analyzer', name: 'Analyzer', responsibility: 'Evidence analysis', state: 'sample-idle' },
  ],
  channels: [
    { id: 'channel-kdp', name: 'KDP', sampleState: 'Not connected (sample)', tone: 'warning' },
    { id: 'channel-etsy', name: 'Etsy', sampleState: 'Eligibility review (sample)', tone: 'warning' },
    { id: 'channel-gumroad', name: 'Gumroad', sampleState: 'Manual workflow (sample)', tone: 'info' },
    { id: 'channel-adobe', name: 'Adobe Stock', sampleState: 'Limited capability (sample)', tone: 'info' },
  ],
  activity: [
    { id: 'activity-001', title: 'Example product intake', description: 'Synthetic event for preview purposes', relativeTime: 'Sample timeline' },
    { id: 'activity-002', title: 'Example research run', description: 'Synthetic event for preview purposes', relativeTime: 'Sample timeline' },
    { id: 'activity-003', title: 'Example quality review', description: 'Synthetic event for preview purposes', relativeTime: 'Sample timeline' },
  ],
  insights: [
    { id: 'insight-conversion', label: 'Conversion', sampleDelta: '+12%', direction: 'up' },
    { id: 'insight-lifetime', label: 'Product lifetime', sampleDelta: '+8%', direction: 'up' },
    { id: 'insight-retention', label: 'Cohort retention', sampleDelta: '+5%', direction: 'up' },
  ],
}
