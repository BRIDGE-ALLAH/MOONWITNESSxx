'use client'

import React, { useEffect } from 'react'

export interface ServiceNode {
  id: string
  name: string
  category: 'core' | 'database' | 'network' | 'analytics' | string
  port?: number | string
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'
  latencyMs: number
  uptime?: string
  load?: string
  probe?: {
    status: string
    latencyMs: number
    target: string
    ok: boolean
    error?: string
    kind?: string
  }
  source?: 'backend' | 'frontend' | 'static'
  timestamp?: string
}

function whyStatus(node: ServiceNode): string {
  const p = node.probe
  if (!p) return 'No probe details available.'
  if (p.kind === 'tcp' && node.source !== 'backend' && p.error === 'tcp probe unavailable in web') {
    return 'TCP probe unavailable in web (frontend limitation). This is not necessarily service offline; use desktop/Tauri for full fidelity.'
  }
  if (p.error) {
    return `Probe error/unreachable: ${p.error}. Service or probe may be unreachable.`
  }
  if (node.status === 'HEALTHY') return 'Probe succeeded and reported healthy.'
  if (node.status === 'WARNING')
    return 'Probe returned non-OK HTTP status; service reachable but degraded.'
  if (node.status === 'CRITICAL') return 'Probe reported critical condition.'
  return 'Probe did not succeed; service/probe unreachable.'
}

export function ServiceNodeGrid({
  nodes,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: ServiceNode[]
  selectedNodeId?: string | null
  onSelectNode?: (id: string | null) => void
}) {
  const statusColors = {
    HEALTHY: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    WARNING: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
    CRITICAL: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
    OFFLINE: 'bg-slate-500/10 border-slate-500/40 text-slate-400',
  }

  const selected = nodes.find((n) => n.id === selectedNodeId) ?? null

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectNode?.(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, onSelectNode])

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="bg-slate-900/80 border border-slate-800 p-4 rounded-lg flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                  :{node.port ?? 'n/a'} &bull; {node.category}
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
              <span>Load: {node.load ?? 'n/a'}</span>
            </div>
            <button
              type="button"
              onClick={() => onSelectNode?.(node.id)}
              aria-expanded={selectedNodeId === node.id}
              aria-label={`Show evidence for ${node.name}`}
              className="mt-3 min-h-[36px] rounded border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] font-mono text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Evidence
            </button>
          </div>
        ))}
      </div>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence for ${selected.name}`}
          className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-4 text-xs font-mono text-slate-200"
        >
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">{selected.name} — Evidence</h4>
            <button
              type="button"
              onClick={() => onSelectNode?.(null)}
              aria-label="Close evidence panel"
              className="min-h-[32px] rounded border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Close
            </button>
          </div>
          <dl className="grid grid-cols-1 gap-1 md:grid-cols-2">
            <dt className="text-slate-500">Status</dt>
            <dd>{selected.status}</dd>
            <dt className="text-slate-500">Probe kind</dt>
            <dd>{selected.probe?.kind ?? 'n/a'}</dd>
            <dt className="text-slate-500">Probe target</dt>
            <dd>{selected.probe?.target ?? 'n/a'}</dd>
            <dt className="text-slate-500">Probe ok</dt>
            <dd>{String(selected.probe?.ok ?? false)}</dd>
            <dt className="text-slate-500">Probe error</dt>
            <dd>{selected.probe?.error ?? 'none'}</dd>
            <dt className="text-slate-500">Latency</dt>
            <dd>{selected.latencyMs}ms</dd>
            <dt className="text-slate-500">Source</dt>
            <dd>{selected.source ?? 'n/a'}</dd>
            <dt className="text-slate-500">Timestamp</dt>
            <dd>{selected.timestamp ?? 'n/a'}</dd>
            <dt className="text-slate-500">Uptime</dt>
            <dd>{selected.uptime ?? 'n/a'}</dd>
            <dt className="text-slate-500">Load</dt>
            <dd>{selected.load ?? 'n/a'}</dd>
            <dt className="text-slate-500">Port</dt>
            <dd>{selected.port ?? 'n/a'}</dd>
          </dl>
          <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
            <span className="text-slate-500">Why this status: </span>
            <span>{whyStatus(selected)}</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
