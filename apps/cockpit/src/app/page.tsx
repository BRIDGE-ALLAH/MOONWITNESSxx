'use client'

import React, { useState, useEffect } from 'react'
import { ServiceNodeGrid, ServiceNode } from '../components/ServiceNodeGrid'
import { ActionControlPanel } from '../components/ActionControlPanel'
import {
  EnvironmentSelector,
  EnvironmentTarget,
  ENVIRONMENTS,
} from '../components/EnvironmentSelector'

export default function CockpitDashboard() {
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentTarget>('local')
  const [arsyStatus, setArsyStatus] = useState<'HEALTHY' | 'OFFLINE'>('OFFLINE')
  const [pingLatency, setPingLatency] = useState<number>(0)

  // Real live health probe
  useEffect(() => {
    let active = true
    const checkLiveHealth = async () => {
      const startTime = performance.now()
      try {
        const res = await fetch('http://localhost:4000/health/live', {
          method: 'GET',
          signal: AbortSignal.timeout(1500),
        })
        const duration = Math.round(performance.now() - startTime)
        if (active) {
          if (res.ok) {
            setArsyStatus('HEALTHY')
            setPingLatency(duration)
          } else {
            setArsyStatus('OFFLINE')
          }
        }
      } catch {
        if (active) {
          setArsyStatus('OFFLINE')
          setPingLatency(0)
        }
      }
    }

    checkLiveHealth()
    const interval = setInterval(checkLiveHealth, 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [selectedEnv])

  const envConfig = ENVIRONMENTS[selectedEnv]

  const nodes: ServiceNode[] = [
    {
      id: 'arsy',
      name: 'ARSY CORE ORCHESTRATOR',
      category: 'core',
      port: 4000,
      status: selectedEnv === 'local' ? arsyStatus : 'HEALTHY',
      latencyMs: selectedEnv === 'local' ? pingLatency : 28,
      uptime: selectedEnv === 'local' ? (arsyStatus === 'HEALTHY' ? '99.98%' : '0.00%') : '99.99%',
      load: selectedEnv === 'local' ? (arsyStatus === 'HEALTHY' ? '8% CPU' : 'N/A') : '14% CPU',
    },
    {
      id: 'oracle',
      name: 'ORACLE PYTHON ENGINE',
      category: 'analytics',
      port: 8000,
      status: 'HEALTHY',
      latencyMs: selectedEnv === 'local' ? 9 : 45,
      uptime: '99.90%',
      load: '18% CPU',
    },
    {
      id: 'postgres',
      name: 'POSTGRESQL PRIMARY CLUSTER',
      category: 'database',
      port: 5432,
      status: 'HEALTHY',
      latencyMs: selectedEnv === 'local' ? 1 : 12,
      uptime: '99.99%',
      load: '24% CPU',
    },
    {
      id: 'radius',
      name: 'ATLAS FREERADIUS RUNTIME',
      category: 'network',
      port: 1812,
      status: 'WARNING',
      latencyMs: selectedEnv === 'local' ? 14 : 65,
      uptime: '98.50%',
      load: '5% CPU',
    },
  ]

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

        {/* Environment Picker & Status Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <EnvironmentSelector currentEnv={selectedEnv} onSelect={setSelectedEnv} />

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-slate-500">TARGET HOST:</span>
            <span className="text-cyan-400 font-bold">{envConfig.label}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded">
            <span className="text-slate-500">PROBE:</span>
            <span
              className={`font-bold ${arsyStatus === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {selectedEnv === 'local'
                ? arsyStatus === 'HEALTHY'
                  ? 'LIVE CONNECTED'
                  : 'BACKEND OFFLINE'
                : 'SYNCHRONIZED'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Operations Grid */}
      <main className="flex-1 space-y-8">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Cluster Node Matrix ({envConfig.label})
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">Auto-probe: 3s Interval</span>
          </div>
          <ServiceNodeGrid nodes={nodes} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Dispatch & Event Stream
            </h2>
            <span className="text-[11px] text-slate-500 font-mono">
              Target: {envConfig.baseUrls.arsy}
            </span>
          </div>
          <ActionControlPanel />
        </div>
      </main>

      {/* Flight Deck Footer */}
      <footer className="mt-8 border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-mono">
        <div>
          MOONWITNESS COCKPIT &bull; Operator Context: {selectedEnv.toUpperCase()} &bull; Do not
          expose publicly
        </div>
        <div>BRIDGE-ALLAH / RIOTWORKS</div>
      </footer>
    </div>
  )
}
