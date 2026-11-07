export type NavigationGroup = 'Command' | 'Operations' | 'Administration'
export type NavigationStatus = 'prototype' | 'planned' | 'live'

export type NavigationItem = {
  href: string | null
  label: string
  group: NavigationGroup
  status: NavigationStatus
  description: string
}

/**
 * Product-facing information architecture.
 * Only routes that exist are navigable; planned administration capabilities
 * remain visible as disabled roadmap entries and are never presented as live.
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: '/arsy-deck', label: 'ARSY DECK', group: 'Command', status: 'prototype', description: 'Workspace pulse and operational review' },
  { href: '/signal-room', label: 'SIGNAL ROOM', group: 'Command', status: 'prototype', description: 'Evidence and market research' },
  { href: '/riot-radar', label: 'RIOT RADAR', group: 'Command', status: 'prototype', description: 'Opportunity evaluation' },
  { href: '/the-forge', label: 'THE FORGE', group: 'Command', status: 'prototype', description: 'Product and asset production' },
  { href: '/zill-watch', label: 'ZILL WATCH', group: 'Command', status: 'prototype', description: 'Quality, rights, and policy inspection' },
  { href: '/decision-graph', label: 'DECISION GRAPH', group: 'Command', status: 'prototype', description: 'Decision rationale, evidence, and contradiction explorer' },
  { href: '/launch-bay', label: 'LAUNCH BAY', group: 'Operations', status: 'prototype', description: 'Marketplace listing preparation' },
  { href: '/sidra-archive', label: 'SIDRA ARCHIVE', group: 'Operations', status: 'prototype', description: 'Asset and provenance library' },
  { href: '/aftershock', label: 'AFTERSHOCK', group: 'Operations', status: 'prototype', description: 'Performance insights and experiments' },
  { href: '/mizan-ledger', label: 'MIZAN LEDGER', group: 'Operations', status: 'prototype', description: 'Financial records and reconciliation' },
  { href: '/riot-engine', label: 'RIOT ENGINE', group: 'Operations', status: 'prototype', description: 'Workflow and run operations' },
  { href: '/infrastructure/docker', label: 'DOCKER', group: 'Operations', status: 'live', description: 'Docker Engine connections and read-only container inventory' },
  { href: '/scenario-forge', label: 'SCENARIO ARENA', group: 'Operations', status: 'prototype', description: 'Shadow-only counterfactual planning and comparison' },
  { href: '/governance-lab', label: 'GOVERNANCE LAB', group: 'Command', status: 'prototype', description: 'Replay integrity, decision debt, and uncertainty review' },
  { href: '/settings-policy', label: 'WORKSPACE SETTINGS / POLICY', group: 'Administration', status: 'prototype', description: 'Prototype workspace and policy placeholders' },
  { href: null, label: 'POLICY CENTER', group: 'Administration', status: 'planned', description: 'Policy and configuration governance' },
  { href: null, label: 'MARKETPLACE ACCOUNTS', group: 'Administration', status: 'planned', description: 'Connected account lifecycle and verification' },
  { href: null, label: 'AI PROVIDERS', group: 'Administration', status: 'planned', description: 'Provider configuration and capabilities' },
  { href: null, label: 'ADDON MANAGER', group: 'Administration', status: 'planned', description: 'Controlled addon lifecycle and permissions' },
  { href: null, label: 'ORM / INFRASTRUCTURE HEALTH', group: 'Administration', status: 'planned', description: 'Restricted diagnostics for technical operators' },
  { href: null, label: 'SECURITY & AUDIT', group: 'Administration', status: 'planned', description: 'Access history and sensitive-operation audit' },
]
