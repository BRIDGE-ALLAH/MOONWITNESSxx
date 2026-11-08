import { DEFAULT_SKIN, isSkinName, SKIN_REGISTRY } from './registry'
import { APPEARANCE_MODES, DENSITY_MODES } from './types'
import type {
  AppearanceMode,
  DensityMode,
  ResolvedSkinConfig,
  SkinConfigInput,
} from './types'

function isAppearanceMode(value: string): value is AppearanceMode {
  return (APPEARANCE_MODES as readonly string[]).includes(value)
}

function isDensityMode(value: string): value is DensityMode {
  return (DENSITY_MODES as readonly string[]).includes(value)
}

/**
 * Resolve untrusted route/config input to a deterministic skin configuration.
 * Unsupported combinations fall back to the selected skin's documented default.
 */
export function resolveSkinConfig(input: SkinConfigInput = {}): ResolvedSkinConfig {
  const fallbackReasons: ResolvedSkinConfig['fallbackReasons'][number][] = []
  let skin = DEFAULT_SKIN

  if (input.skin === undefined || input.skin.trim() === '') {
    fallbackReasons.push('missing-skin')
  } else if (isSkinName(input.skin)) {
    skin = input.skin
  } else {
    fallbackReasons.push('unknown-skin')
  }

  const definition = SKIN_REGISTRY[skin]
  let mode = definition.defaultMode

  if (input.mode !== undefined && input.mode !== '') {
    if (!isAppearanceMode(input.mode)) {
      fallbackReasons.push('unknown-mode')
    } else if (!(definition.supportedModes as readonly string[]).includes(input.mode)) {
      fallbackReasons.push('unsupported-mode')
    } else {
      mode = input.mode
    }
  }

  let density = definition.defaultDensity
  if (input.density !== undefined && input.density !== '') {
    if (isDensityMode(input.density)) {
      density = input.density
    } else {
      fallbackReasons.push('unknown-density')
    }
  }

  return { skin, mode, density, fallbackReasons }
}
