'use client'

import React from 'react'

export type ActionId =
  | 'DIAGNOSTIC_HEALTH_CHECK'
  | 'FLUSH_CONTAINER_CACHE'
  | 'CYCLE_SOCKET_CONNECTOR'
  | 'EMERGENCY_DEGRADE_SYSTEM'

export interface ActionControlPanelProps {
  logs: string[]
  onDispatch: (action: ActionId, source?: 'operator' | 'copilot-draft') => boolean
}

const ACTIONS: Array<{ id: ActionId; label: string; destructive?: boolean }> = [
  { id: 'DIAGNOSTIC_HEALTH_CHECK', label: '> Run Diagnostics Sweep' },
  { id: 'FLUSH_CONTAINER_CACHE', label: '> Flush Redis Queue Cache' },
  { id: 'CYCLE_SOCKET_CONNECTOR', label: '> Recycle Docker Socket Connector' },
  { id: 'EMERGENCY_DEGRADE_SYSTEM', label: '! Fail-Closed Lockdown Mode', destructive: true },
]

export function ActionControlPanel({ logs, onDispatch }: ActionControlPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-5">
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-white">
            Operator Controls
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Authorized operational dispatches. Actions require explicit confirmation before
            execution. Destructive actions require a stronger confirmation.
          </p>

          <div className="flex flex-col gap-2.5">
            {ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onDispatch(action.id, 'operator')}
                className={`min-h-[44px] w-full rounded border px-3 py-2 text-left text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  action.destructive
                    ? 'border-rose-800/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50'
                    : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700/80'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800 pt-3 font-mono text-[11px] text-slate-500">
          Security: Ed25519 Capability Bound. Human confirmation required.
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"
              aria-hidden="true"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Live Telemetry Stream
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">CHANNEL: OPERATOR-NOC-01</span>
        </div>

        <div
          className="h-48 space-y-1.5 overflow-y-auto pr-2 font-mono text-xs text-slate-300"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {logs.map((log, idx) => (
            <div key={`${idx}-${log.slice(0, 24)}`} className="flex gap-2">
              <span className="select-none text-slate-600">&gt;</span>
              <span
                className={
                  log.includes('OPERATOR_ACTION') || log.includes('COPILOT_DRAFT')
                    ? 'text-amber-400'
                    : log.includes('CANCELLED') || log.includes('BLOCKED')
                      ? 'text-rose-300'
                      : 'text-slate-300'
                }
              >
                {log}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
          <span>HOST: LOCAL-OPERATOR-WORKSTATION</span>
          <span>BUFFER: {Math.min(logs.length, 1000)}/1000 EVENTS</span>
        </div>
      </div>
    </div>
  )
}
