'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SkinRoot } from '@riotworks/ui'
import { useTheme } from 'next-themes'
import { Texture } from '@riotworks/assets'
import { CommandPalette } from '../shell/command-palette'
import { NAVIGATION_ITEMS } from '../shell/navigation'
import { Sidebar } from '../shell/sidebar'
import { Topbar } from '../shell/topbar'
import { resolveHeadquarterSkin } from '../shell/route-skin'

const LABELS = {
  search: 'Search / Command Palette',
  workspace: 'Operator console',
  demo: 'Prototype modules // integration maturity varies',
  theme: 'Toggle theme',
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const routeSkin = resolveHeadquarterSkin(pathname)
  const [mounted, setMounted] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => setTheme(routeSkin.mode), [routeSkin.mode, setTheme])
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

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const isDark = mounted ? resolvedTheme === 'dark' : routeSkin.mode === 'dark'
  const activeMode = mounted && (resolvedTheme === 'dark' || resolvedTheme === 'light') ? resolvedTheme : routeSkin.mode

  return (
    <SkinRoot skin={routeSkin.skin} mode={activeMode} density={routeSkin.density} className="relative isolate min-h-screen">
      <Texture name="texture.lunar-contours" opacity={0.025} className="pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar isOpen={navOpen} demoLabel={LABELS.demo} onNavigate={() => setNavOpen(false)} />
          <div className="min-w-0 flex-1">
            <Topbar
              navOpen={navOpen}
              labels={LABELS}
              onToggleNavigation={() => setNavOpen((current) => !current)}
              onOpenPalette={openPalette}
              onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
            />
            <div>{children}</div>
          </div>
        </div>
        <CommandPalette open={paletteOpen} items={NAVIGATION_ITEMS} onClose={closePalette} />
      </div>
    </SkinRoot>
  )
}
