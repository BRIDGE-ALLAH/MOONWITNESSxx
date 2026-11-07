export type NavigationGroup = 'Core' | 'Operations' | 'System'
export type NavigationItem = { href: string; label: string; group: NavigationGroup }

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: '/arsy-deck', label: 'ARSY DECK', group: 'Core' },
  { href: '/signal-room', label: 'SIGNAL ROOM', group: 'Core' },
  { href: '/riot-radar', label: 'RIOT RADAR', group: 'Core' },
  { href: '/the-forge', label: 'THE FORGE', group: 'Core' },
  { href: '/zill-watch', label: 'ZILL WATCH', group: 'Core' },
  { href: '/launch-bay', label: 'LAUNCH BAY', group: 'Operations' },
  { href: '/sidra-archive', label: 'SIDRA ARCHIVE', group: 'Operations' },
  { href: '/mizan-ledger', label: 'MIZAN LEDGER', group: 'Operations' },
  { href: '/aftershock', label: 'AFTERSHOCK', group: 'Operations' },
  { href: '/riot-engine', label: 'RIOT ENGINE', group: 'Operations' },
  { href: '/settings-policy', label: 'SETTINGS / POLICY', group: 'System' },
]
