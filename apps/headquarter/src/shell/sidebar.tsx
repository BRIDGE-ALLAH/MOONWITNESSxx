'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
      aria-label="Headquarter sidebar"
      className={cn('w-72 shrink-0 border-r border-acid-lime/20 bg-panel-charcoal/40 p-4', !isOpen && 'hidden md:block')}
    >
      <Link href="/" onClick={onNavigate} className="block border-2 border-acid-lime/40 p-3">
        <div className="font-display text-xl uppercase leading-none">MOONWITNESS</div>
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">// RIOTWORKS</div>
      </Link>
      <div className="mt-4"><Badge variant="lime">{demoLabel}</Badge></div>
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
                      className={cn('block border px-3 py-2 font-mono text-xs uppercase tracking-wide', active ? 'border-acid-lime bg-acid-lime/10 text-acid-lime' : 'border-transparent hover:border-acid-lime/30')}
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
