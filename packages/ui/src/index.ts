// Re-export the shared MOONWITNESS UI primitives and skin foundation.
export { Button, buttonVariants } from './components/button'
export type { ButtonProps } from './components/button'
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './components/card'
export { Badge } from './components/badge'
export type { BadgeProps } from './components/badge'
export { Separator } from './components/separator'
export { cn } from './lib/utils'
export { HalftoneSurface, type HalftoneSurfaceProps } from './components/halftone-surface'
export { SkinRoot, type SkinRootProps } from './skin/skin-root'
export { DEFAULT_SKIN, SKIN_REGISTRY, getSkinDefinition, isSkinName } from './skin/registry'
export { resolveSkinConfig } from './skin/resolve'
export {
  APPEARANCE_MODES,
  DENSITY_MODES,
  SKIN_NAMES,
} from './skin/types'
export type {
  AppearanceMode,
  DensityMode,
  ResolvedSkinConfig,
  SkinConfigInput,
  SkinDefinition,
  SkinFallbackReason,
  SkinName,
} from './skin/types'
