'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AssetImage } from '@riotworks/assets'
import { Badge, cn } from '@riotworks/ui'
import { NAVIGATION_ITEMS } from './navigation'

type SidebarProps = { isOpen: boolean; demoLabel: string; onNavigate: () => void }

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar({ isOpen, demoLabel, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const groups = Array.from(new Set(NAVIGATION_ITEMS.map((item) => item.group)))

  return (
    <aside
      id="headquarter-sidebar"
      aria-label="MOONWITNESS navigation"
      className={cn('w-72 shrink-0 border-r border-signal-gold/20 bg-card/70 p-4', !isOpen && 'hidden md:block')}
    >
      <Link href="/" onClick={onNavigate} aria-label="MOONWITNESS home" className="block border border-signal-gold/35 bg-background p-3">
        <AssetImage name="brand.lockup" alt="MOONWITNESS — See more. Know more." className="h-auto w-full" />
      </Link>
      <div className="mt-4"><Badge variant="outline">{demoLabel}</Badge></div>
      <nav aria-label="Main navigation" className="mt-6 space-y-5">
        {groups.map((group) => (
          <section key={group} aria-labelledby={`nav-group-${group.toLowerCase()}`}>
            <h2 id={`nav-group-${group.toLowerCase()}`} className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{group}</h2>
            <ul className="space-y-1">
              {NAVIGATION_ITEMS.filter((item) => item.group === group).map((item) => {
                const active = isActivePath(pathname, item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn('block border px-3 py-2 font-mono text-xs uppercase tracking-wide', active ? 'border-signal-gold bg-signal-gold/10 text-signal-gold' : 'border-transparent hover:border-signal-gold/30')}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>
    </aside>
  )
}
