'use client'

import { Badge, Button } from '@riotworks/ui'

type TopbarProps = {
  locale: 'en' | 'id'
  navOpen: boolean
  labels: { search: string; workspace: string; notifications: string; locale: string; theme: string; profile: string; demo: string }
  onToggleNavigation: () => void
  onOpenPalette: () => void
  onNotify: () => void
  onToggleLocale: () => void
  onToggleTheme: () => void
}

export function Topbar({ locale, navOpen, labels, onToggleNavigation, onOpenPalette, onNotify, onToggleLocale, onToggleTheme }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-signal-gold/15 bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button variant="outline" size="sm" className="md:hidden" aria-controls="headquarter-sidebar" aria-expanded={navOpen} onClick={onToggleNavigation}>NAV</Button>
        <Button variant="outline" size="sm" onClick={onOpenPalette}>{labels.search} (Ctrl+K)</Button>
        <span className="font-mono text-[11px] uppercase text-muted-foreground">{labels.workspace}</span>
        <Badge variant="warning" role="status" aria-label={labels.demo}>{labels.demo}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onNotify}>{labels.notifications}</Button>
          <Button variant="secondary" size="sm" onClick={onToggleLocale} aria-label={locale === 'en' ? 'Switch prototype locale to Indonesian' : 'Switch prototype locale to English'}>{labels.locale}</Button>
          <Button variant="secondary" size="sm" onClick={onToggleTheme}>{labels.theme}</Button>
          <Badge variant="outline">{labels.profile}</Badge>
        </div>
      </div>
    </header>
  )
}
