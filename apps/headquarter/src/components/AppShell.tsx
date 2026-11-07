'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { CommandPalette } from '../shell/command-palette'
import { NAVIGATION_ITEMS } from '../shell/navigation'
import { Sidebar } from '../shell/sidebar'
import { Topbar } from '../shell/topbar'

const STRINGS = {
  en: { search: 'Search / Command Palette', workspace: 'Workspace: Demo', notifications: 'Notifications', locale: 'EN', theme: 'Theme', profile: 'Operator', demo: 'Prototype // Demo Data Only' },
  id: { search: 'Cari / Palet Perintah', workspace: 'Ruang Kerja: Demo', notifications: 'Notifikasi', locale: 'ID', theme: 'Tema', profile: 'Operator', demo: 'Prototipe // Data Demo Saja' },
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [locale, setLocale] = useState<'en' | 'id'>('en')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])
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
  const labels = STRINGS[locale]
  const isDark = mounted ? resolvedTheme === 'dark' : true

  return (
    <div className="min-h-screen bg-background text-foreground">
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
            onToggleTheme={() => {
              setTheme(isDark ? 'light' : 'dark')
              notify('Prototype: theme toggled')
            }}
          />
          <div>{children}</div>
        </div>
      </div>
      <CommandPalette open={paletteOpen} items={NAVIGATION_ITEMS} onClose={closePalette} />
      {notice ? <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 border-2 border-acid-lime bg-background px-4 py-2 font-mono text-xs uppercase text-acid-lime shadow-lg">{notice}</div> : null}
    </div>
  )
}
