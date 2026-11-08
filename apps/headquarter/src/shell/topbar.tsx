'use client'

import { Badge, Button } from '@riotworks/ui'

type TopbarProps = {
  navOpen: boolean
  labels: { search: string; workspace: string; demo: string; theme: string }
  onToggleNavigation: () => void
  onOpenPalette: () => void
  onToggleTheme: () => void
}

export function Topbar({
  navOpen,
  labels,
  onToggleNavigation,
  onOpenPalette,
  onToggleTheme,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-signal-gold/15 bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          aria-controls="headquarter-sidebar"
          aria-expanded={navOpen}
          onClick={onToggleNavigation}
        >
          NAV
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPalette}>
          {labels.search} (Ctrl+K)
        </Button>
        <span className="font-mono text-[11px] uppercase text-muted-foreground">
          {labels.workspace}
        </span>
        <Badge variant="warning" role="status" aria-label={labels.demo}>
          {labels.demo}
        </Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleTheme}
            aria-label={labels.theme}
          >
            {labels.theme}
          </Button>
        </div>
      </div>
    </header>
  )
}
