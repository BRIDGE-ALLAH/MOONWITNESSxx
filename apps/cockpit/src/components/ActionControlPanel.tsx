'use client'

import React, { useState } from 'react'

export function ActionControlPanel() {
  const [logs, setLogs] = useState<string[]>([
    '[INIT] Telemetry socket initialized on localhost',
    '[SYNC] ARSY Fastify daemon discovered on port 4000 (HEALTHY)',
    '[SYNC] ORACLE Stage 1 analytical container online (HEALTHY)',
    '[NOC] Flight deck telemetry stream engaged',
  ])

  const executeAction = (actionName: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [`[${timestamp}] OPERATOR_ACTION: ${actionName} triggered`, ...prev])
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Operator Triggers */}
      <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-lg flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Operator Controls
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Authorized operational dispatches across local containers and network runtimes.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => executeAction('DIAGNOSTIC_HEALTH_CHECK')}
              className="w-full text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono text-slate-200 transition"
            >
              &gt; Run Diagnostics Sweep
            </button>
            <button
              onClick={() => executeAction('FLUSH_CONTAINER_CACHE')}
              className="w-full text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono text-slate-200 transition"
            >
              &gt; Flush Redis Queue Cache
            </button>
            <button
              onClick={() => executeAction('CYCLE_SOCKET_CONNECTOR')}
              className="w-full text-left px-3 py-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono text-slate-200 transition"
            >
              &gt; Recycle Docker Socket Connector
            </button>
            <button
              onClick={() => executeAction('EMERGENCY_DEGRADE_SYSTEM')}
              className="w-full text-left px-3 py-2 rounded bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-xs font-mono text-rose-300 transition"
            >
              ! Fail-Closed Lockdown Mode
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
          Security: Ed25519 Capability Bound
        </div>
      </div>

      {/* Terminal Telemetry Log Stream */}
      <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              Live Telemetry Stream
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">CHANNEL: OPERATOR-NOC-01</span>
        </div>

        <div className="h-48 overflow-y-auto font-mono text-xs text-slate-300 space-y-1.5 pr-2">
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-slate-600 select-none">&gt;</span>
              <span
                className={log.includes('OPERATOR_ACTION') ? 'text-amber-400' : 'text-slate-300'}
              >
                {log}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800/80 pt-2 text-[10px] text-slate-500 flex justify-between">
          <span>HOST: LOCAL-OPERATOR-WORKSTATION</span>
          <span>BUFFER: 4/1000 EVENTS</span>
        </div>
      </div>
    </div>
  )
}
