'use client'

import React from 'react'

export interface ServiceNode {
  id: string
  name: string
  category: 'core' | 'database' | 'network' | 'analytics'
  port: number | string
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'
  latencyMs: number
  uptime: string
  load: string
}

export function ServiceNodeGrid({ nodes }: { nodes: ServiceNode[] }) {
  const statusColors = {
    HEALTHY: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    WARNING: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
    CRITICAL: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
    OFFLINE: 'bg-slate-500/10 border-slate-500/40 text-slate-400',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="bg-slate-900/80 border border-slate-800 p-4 rounded-lg flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                :{node.port} &bull; {node.category}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${statusColors[node.status]}`}
              >
                {node.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-white font-mono">{node.name}</h3>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Ping: {node.latencyMs}ms</span>
            <span>Load: {node.load}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
