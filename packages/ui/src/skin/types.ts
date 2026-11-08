export const SKIN_NAMES = ['observatory', 'archive', 'signal'] as const

export type SkinName = (typeof SKIN_NAMES)[number]

export const APPEARANCE_MODES = ['dark', 'light'] as const
export type AppearanceMode = (typeof APPEARANCE_MODES)[number]

export const DENSITY_MODES = ['comfortable', 'compact'] as const
export type DensityMode = (typeof DENSITY_MODES)[number]

export interface SkinDefinition {
  readonly name: SkinName
  readonly label: string
  readonly description: string
  readonly purpose: string
  readonly avoidFor: readonly string[]
  readonly defaultMode: AppearanceMode
  readonly supportedModes: readonly AppearanceMode[]
  readonly defaultDensity: DensityMode
}

export interface SkinConfigInput {
  readonly skin?: string
  readonly mode?: string
  readonly density?: string
}

export type SkinFallbackReason =
  | 'missing-skin'
  | 'unknown-skin'
  | 'unsupported-mode'
  | 'unknown-mode'
  | 'unknown-density'

export interface ResolvedSkinConfig {
  readonly skin: SkinName
  readonly mode: AppearanceMode
  readonly density: DensityMode
  readonly fallbackReasons: readonly SkinFallbackReason[]
}
