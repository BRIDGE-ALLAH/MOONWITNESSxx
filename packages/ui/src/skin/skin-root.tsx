import type { HTMLAttributes } from 'react'
import { cn } from '../lib/utils'
import { resolveSkinConfig } from './resolve'

export interface SkinRootProps extends HTMLAttributes<HTMLDivElement> {
  /** Experience skin applied to this application or route boundary. */
  skin: string
  /** Appearance mode; unsupported values resolve to the skin's default mode. */
  mode?: string
  /** Information density, independent from skin and appearance mode. */
  density?: string
}

/**
 * A deterministic, server-compatible root for applying a MOONWITNESS skin.
 * It deliberately does not manage user preferences or application state.
 */
export function SkinRoot({
  skin,
  mode,
  density,
  className,
  children,
  ...props
}: SkinRootProps) {
  const config = resolveSkinConfig({ skin, mode, density })
  const fallback = config.fallbackReasons.length
    ? config.fallbackReasons.join(',')
    : undefined

  return (
    <div
      {...props}
      className={cn('mw-skin-root', className)}
      data-mw-skin={config.skin}
      data-mw-mode={config.mode}
      data-mw-density={config.density}
      data-mw-fallback={fallback}
    >
      {children}
    </div>
  )
}
