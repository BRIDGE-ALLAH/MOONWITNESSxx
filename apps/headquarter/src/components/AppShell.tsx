'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, cn } from '@riotworks/ui'

type NavItem = { href: string; label: string; group: string }

const NAV: NavItem[] = [
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

const STRINGS = {
  en: { search: 'Search / Command Palette (prototype)', workspace: 'Workspace: Demo', notifications: 'Notifications', locale: 'EN', theme: 'Theme', profile: 'Operator', demo: 'Prototype // Demo Data Only' },
  id: { search: 'Cari / Palet Perintah (prototipe)', workspace: 'Ruang Kerja: Demo', notifications: 'Notifikasi', locale: 'ID', theme: 'Tema', profile: 'Operator', demo: 'Prototipe // Data Demo Saja' },
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [locale, setLocale] = useState<'en' | 'id'>('en')
  const [query, setQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const t = STRINGS[locale]
  const groups = useMemo(() => Array.from(new Set(NAV.map((n) => n.group))), [])
  const filtered = NAV.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))

  const notify = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 2200)
  }

  const isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className={cn('w-72 shrink-0 border-r border-acid-lime/20 bg-panel-charcoal/40 p-4', !navOpen && 'hidden md:block')}>
          <Link href="/" className="block border-2 border-acid-lime/40 p-3">
            <div className="font-display text-xl uppercase leading-none">MOONWITNESS</div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{'// RIOTWORKS'}</div>
          </Link>
          <div className="mt-4"><Badge variant="lime">{t.demo}</Badge></div>
          <nav className="mt-6 space-y-5">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{g}</div>
                <div className="space-y-1">
                  {NAV.filter((n) => n.group === g).map((n) => (
                    <Link key={n.href} href={n.href} onClick={() => setNavOpen(false)} className={cn('block border px-3 py-2 font-mono text-xs uppercase tracking-wide', pathname === n.href ? 'border-acid-lime bg-acid-lime/10 text-acid-lime' : 'border-transparent hover:border-acid-lime/30')}>
                      {n.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-acid-lime/20 bg-background/95 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 p-3">
              <Button variant="outline" size="sm" className="md:hidden" onClick={() => setNavOpen((v) => !v)}>NAV</Button>
              <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)}>{t.search} (Ctrl+K)</Button>
              <span className="font-mono text-[11px] uppercase text-muted-foreground">{t.workspace}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => notify(`Prototype: ${t.notifications}`)}>{t.notifications}</Button>
                <Button variant="electric" size="sm" onClick={() => { setLocale((l) => (l === 'en' ? 'id' : 'en')); notify('Prototype: locale toggled') }}>{t.locale}</Button>
                <Button variant="riot" size="sm" onClick={() => { setTheme(isDark ? 'light' : 'dark'); notify('Prototype: theme toggled') }}>{t.theme}</Button>
                <Badge variant="outline">{t.profile}</Badge>
              </div>
            </div>
          </header>
          <div>{children}</div>
        </div>
      </div>

      {paletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24" role="dialog" aria-label="Command palette" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-xl border-2 border-acid-lime/40 bg-background p-3" onClick={(e) => e.stopPropagation()}>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a module name… (prototype)" className="w-full border border-acid-lime/30 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-acid-lime" />
            <div className="mt-2 max-h-72 overflow-auto">
              {filtered.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => { setPaletteOpen(false); notify(`Prototype: navigated to ${n.label}`) }} className="block border-b border-acid-lime/10 px-2 py-2 font-mono text-xs uppercase hover:bg-acid-lime/10">{n.label}</Link>
              ))}
              {!filtered.length ? <div className="px-2 py-3 text-sm text-muted-foreground">No matches (prototype).</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {notice ? <div className="fixed bottom-4 right-4 z-50 border-2 border-acid-lime bg-background px-4 py-2 font-mono text-xs uppercase text-acid-lime shadow-lg">{notice}</div> : null}
    </div>
  )
}
