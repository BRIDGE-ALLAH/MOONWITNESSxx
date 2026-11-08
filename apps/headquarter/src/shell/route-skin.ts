export type HeadquarterRouteSkin = Readonly<{
  skin: 'observatory' | 'archive'
  mode: 'dark' | 'light'
  density: 'comfortable'
}>

const OBSERVATORY_SKIN: HeadquarterRouteSkin = Object.freeze({
  skin: 'observatory',
  mode: 'dark',
  density: 'comfortable',
})

const ARCHIVE_SKIN: HeadquarterRouteSkin = Object.freeze({
  skin: 'archive',
  mode: 'light',
  density: 'comfortable',
})

/**
 * Resolve Headquarter routes to task-led skin profiles.
 * SIDRA Archive is the only current record-first route; operational routes use Observatory.
 * Signal remains an internal specimen until a real public/editorial route exists.
 */
export function resolveHeadquarterSkin(pathname: string | null | undefined): HeadquarterRouteSkin {
  const path = pathname?.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'

  if (path === '/sidra-archive' || path.startsWith('/sidra-archive/')) {
    return ARCHIVE_SKIN
  }

  return OBSERVATORY_SKIN
}
