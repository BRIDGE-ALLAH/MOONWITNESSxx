'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Texture } from '@riotworks/assets'
import { SkinRoot } from '@riotworks/ui'
import { CommandPalette } from '../shell/command-palette'
import { NAVIGATION_ITEMS } from '../shell/navigation'
import { Sidebar } from '../shell/sidebar'
import { Topbar } from '../shell/topbar'
import { resolveHeadquarterSkin } from '../shell/route-skin'

const STRINGS = {
  en: { search: 'Search / Command Palette', notifications: 'Notifications', locale: 'EN', profile: 'Witness', demo: 'Prototype // Demo Data Only' },
  id: { search: 'Cari / Palet Perintah', notifications: 'Notifikasi', locale: 'ID', profile: 'Witness', demo: 'Prototipe // Data Demo Saja' },
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const routeSkin = resolveHeadquarterSkin(usePathname())
  const [locale, setLocale] = useState<'en' | 'id'>('en')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
  }, [])

  const notify = useCallback((message: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setNotice(message)
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2200)
  }, [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const workspaceLabel = routeSkin.skin === 'archive'
    ? locale === 'en' ? 'Workspace: Archive' : 'Ruang Arsip'
    : locale === 'en' ? 'Workspace: Observatory' : 'Ruang Observasi'
  const labels = { ...STRINGS[locale], workspace: workspaceLabel }

  return (
    <SkinRoot {...routeSkin} className="relative isolate min-h-screen bg-background text-foreground">
      <Texture name="texture.lunar-contours" opacity={0.025} className="pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar isOpen={navOpen} demoLabel={labels.demo} onNavigate={() => setNavOpen(false)} />
          <div className="min-w-0 flex-1">
            <Topbar
              locale={locale}
              navOpen={navOpen}
              labels={labels}
              onToggleNavigation={() => setNavOpen((current) => !current)}
              onOpenPalette={openPalette}
              onNotify={() => notify(`Prototype: ${labels.notifications}`)}
              onToggleLocale={() => {
                setLocale((current) => (current === 'en' ? 'id' : 'en'))
                notify('Prototype: locale toggled')
              }}
            />
            <div>{children}</div>
          </div>
        </div>
        <CommandPalette open={paletteOpen} items={NAVIGATION_ITEMS} onClose={closePalette} />
        {notice ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 border border-signal-gold bg-background px-4 py-2 font-mono text-xs uppercase text-signal-gold shadow-lg">{notice}</div> : null}
      </div>
    </SkinRoot>
  )
}
