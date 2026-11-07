import * as React from 'react'
import { cn } from '../lib/utils'

export type RiotSignalState = 'live' | 'idle' | 'alert'
const stateClasses: Record<RiotSignalState, string> = {
  live: 'riot-live-indicator--live',
  idle: 'riot-live-indicator--idle',
  alert: 'riot-live-indicator--alert',
}
const signalLabels: Record<RiotSignalState, string> = { live: 'Live', idle: 'Standby', alert: 'Attention' }

export interface RiotLiveIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  state?: RiotSignalState
  label?: string
}

/** A compact, accessible status marker. Motion is decorative and respects reduced-motion preferences. */
export function RiotLiveIndicator({ state = 'live', label, className, ...props }: RiotLiveIndicatorProps) {
  return (
    <span className={cn('riot-live-indicator', stateClasses[state], className)} role="status" aria-live="polite" {...props}>
      <span className="riot-live-indicator__dot" aria-hidden="true" />
      <span>{label ?? signalLabels[state]}</span>
    </span>
  )
}

export interface RiotSignalHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  index?: string
  state?: RiotSignalState
  statusLabel?: string
  actions?: React.ReactNode
  level?: 1 | 2 | 3
}

/** Editorial page header that gives operational screens a consistent MOONWITNESS signal signature. */
export function RiotSignalHeader({
  eyebrow, title, description, index, state, statusLabel, actions, level = 1, className, ...props
}: RiotSignalHeaderProps) {
  const Heading = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
  return (
    <header className={cn('riot-signal-header', className)} {...props}>
      <div className="riot-signal-header__main">
        <div className="riot-signal-header__eyebrow">
          <span>{eyebrow}</span>
          {index ? <span className="riot-signal-header__index">{index}</span> : null}
          {state ? <RiotLiveIndicator state={state} label={statusLabel} /> : null}
        </div>
        <Heading className="riot-signal-header__title">{title}</Heading>
        {description ? <p className="riot-signal-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="riot-signal-header__actions">{actions}</div> : null}
    </header>
  )
}

export interface RiotAtmosphereProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'night' | 'paper'
  grid?: boolean
}

/** A restrained ambient canvas. Decorative layers are hidden from assistive technology. */
export function RiotAtmosphere({ tone = 'night', grid = true, className, children, ...props }: RiotAtmosphereProps) {
  return (
    <div className={cn('riot-atmosphere', tone === 'night' ? 'riot-atmosphere--night' : 'riot-atmosphere--paper', grid && 'riot-atmosphere--grid', className)} {...props}>
      <span className="riot-atmosphere__glow" aria-hidden="true" />
      <span className="riot-atmosphere__grain" aria-hidden="true" />
      <div className="riot-atmosphere__content">{children}</div>
    </div>
  )
}
