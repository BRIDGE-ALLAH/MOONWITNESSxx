'use client'

import React, { useState } from 'react'
import {
  probeGateDaemon,
  dispatchGateCommand,
  type GateDaemonStatus,
  type GateCommandResult,
} from '../lib/gateInterop'

export function GateDaemonBridgePanel() {
  const [status, setStatus] = useState<GateDaemonStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [commandResult, setCommandResult] = useState<GateCommandResult | null>(null)

  const handleProbe = async () => {
    setLoading(true)
    try {
      const res = await probeGateDaemon()
      setStatus(res)
    } finally {
      setLoading(false)
    }
  }

  const handleCommand = async (command: 'reload_routes' | 'flush_cache' | 'sync_mesh') => {
    setLoading(true)
    try {
      const res = await dispatchGateCommand({ command })
      setCommandResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            Gate Daemon Interop & IPC
          </h3>
          <p className="text-xs text-muted-foreground">
            Direct IPC / Local HTTP Bridge connecting Cockpit with Gate runtime
          </p>
        </div>
        <button
          onClick={handleProbe}
          disabled={loading}
          className="px-3 py-1 text-xs font-medium rounded border border-border/50 hover:bg-muted/40 transition-colors"
        >
          {loading ? 'Probing...' : 'Probe Daemon'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
          <div className="text-muted-foreground">Daemon Status</div>
          <div className="font-semibold text-foreground mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                status?.online ? 'bg-emerald-400' : 'bg-amber-400/80'
              }`}
            />
            {status ? (status.online ? 'Online' : 'Standby / Fallback') : 'Not Checked'}
          </div>
        </div>

        <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
          <div className="text-muted-foreground">Mode</div>
          <div className="font-semibold text-foreground mt-1 font-mono">
            {status?.mode ?? 'Auto'}
          </div>
        </div>

        <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
          <div className="text-muted-foreground">IPC Latency</div>
          <div className="font-semibold text-foreground mt-1 font-mono">
            {status?.latencyMs !== undefined ? `${status.latencyMs} ms` : '-'}
          </div>
        </div>

        <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
          <div className="text-muted-foreground">Target Port</div>
          <div className="font-semibold text-foreground mt-1 font-mono">
            :{status?.port ?? 4001}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border/20 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-muted-foreground mr-1">Remote Ops:</span>
        <button
          onClick={() => handleCommand('reload_routes')}
          disabled={loading}
          className="px-2.5 py-1 text-xs rounded border border-border/40 hover:bg-muted/50 text-foreground"
        >
          Reload Routes
        </button>
        <button
          onClick={() => handleCommand('flush_cache')}
          disabled={loading}
          className="px-2.5 py-1 text-xs rounded border border-border/40 hover:bg-muted/50 text-foreground"
        >
          Flush Cache
        </button>
        <button
          onClick={() => handleCommand('sync_mesh')}
          disabled={loading}
          className="px-2.5 py-1 text-xs rounded border border-border/40 hover:bg-muted/50 text-foreground"
        >
          Sync Mesh
        </button>
      </div>

      {commandResult && (
        <div className="p-2.5 bg-muted/30 border border-border/30 rounded text-xs font-mono">
          <span className="text-emerald-400 font-bold">[IPC ACK]</span> {commandResult.output}
        </div>
      )}
    </div>
  )
}
