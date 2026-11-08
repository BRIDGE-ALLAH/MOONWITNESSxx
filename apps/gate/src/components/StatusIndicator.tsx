import React from 'react'

export type SystemStatus = 'active' | 'target' | 'degraded' | 'offline'

export interface StatusIndicatorProps {
  status: SystemStatus
  label?: string
  pulse?: boolean
  className?: string
}

const statusConfig: Record<
  SystemStatus,
  {
    bg: string
    border: string
    dot: string
    text: string
    defaultLabel: string
  }
> = {
  active: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    defaultLabel: 'Live / Operational',
  },
  target: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
    text: 'text-sky-400',
    defaultLabel: 'Target Experience',
  },
  degraded: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    defaultLabel: 'Degraded / Prototype',
  },
  offline: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400',
    text: 'text-slate-400',
    defaultLabel: 'Planned / Inactive',
  },
}

export function StatusIndicator({
  status,
  label,
  pulse = true,
  className = '',
}: StatusIndicatorProps) {
  const config = statusConfig[status] || statusConfig.offline
  const displayLabel = label || config.defaultLabel

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-mono font-medium ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (status === 'active' || status === 'degraded') && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
      </span>
      <span>{displayLabel}</span>
    </div>
  )
}
