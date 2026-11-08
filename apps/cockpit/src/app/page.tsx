'use client'

import React from 'react'
import { ServiceNodeGrid, ServiceNode } from '../components/ServiceNodeGrid'
import { ActionControlPanel } from '../components/ActionControlPanel'

const CLUSTER_NODES: ServiceNode[] = [
  {
    id: 'arsy',
    name: 'ARSY CORE ORCHESTRATOR',
    category: 'core',
    port: 4000,
    status: 'HEALTHY',
    latencyMs: 4,
    uptime: '99.98%',
    load: '12% CPU',
  },
  {
    id: 'oracle',
    name: 'ORACLE PYTHON ENGINE',
    category: 'analytics',
    port: 8000,
    status: 'HEALTHY',
    latencyMs: 9,
    uptime: '99.90%',
    load: '18% CPU',
  },
  {
    id: 'postgres',
    name: 'POSTGRESQL PRIMARY CLUSTER',
    category: 'database',
    port: 5432,
    status: 'HEALTHY',
    latencyMs: 1,
    uptime: '99.99%',
    load: '24% CPU',
  },
  {
    id: 'radius',
    name: 'ATLAS FREERADIUS RUNTIME',
    category: 'network',
    port: 1812,
    status: 'WARNING',
    latencyMs: 14,
    uptime: '98.50%',
    load: '5% CPU',
  },
]

export default function CockpitDashboard() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 md:p-8 bg-slate-950 text-slate-100">
      {/* Flight Deck Header */}
      <header className="border-b border-slate-800 pb-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold font-mono text-lg">
            CP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Operations Flight Deck &bull; Experience 08 / 09
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/40">
                DESKTOP NOC
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">MOONWITNESS COCKPIT</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-slate-500">RUNTIME:</span>
            <span className="text-emerald-400 font-bold">RUST + TAURI</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-slate-500">MODE:</span>
            <span className="text-amber-400 font-bold">OPERATOR PRIVILEGED</span>
          </div>
        </div>
      </header>

      {/* Main Operations Grid */}
      <main className="flex-1 space-y-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Cluster Node Matrix
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">Total Nodes: 4 Operational</span>
          </div>
          <ServiceNodeGrid nodes={CLUSTER_NODES} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Dispatch & Event Stream
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">Auto-reconnect: ENABLED</span>
          </div>
          <ActionControlPanel />
        </div>
      </main>

      {/* Flight Deck Footer */}
      <footer className="mt-8 border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono">
        <div>MOONWITNESS COCKPIT &bull; Real-time Operations &bull; Do not expose publicly</div>
        <div>BRIDGE-ALLAH / RIOTWORKS</div>
      </footer>
    </div>
  )
}
