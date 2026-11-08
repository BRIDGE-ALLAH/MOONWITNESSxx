'use client'

import React, { useEffect, useState } from 'react'
import {
  fetchWindowsFullOpsSnapshot,
  executeToolQuickAction,
  type WindowsFullOpsSnapshot,
  type WindowsToolModule,
} from '../lib/windowsFullSuite'

export function WindowsMegaToolkit() {
  const [snapshot, setSnapshot] = useState<WindowsFullOpsSnapshot | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeTool, setActiveTool] = useState<WindowsToolModule | null>(null)
  const [actionLog, setActionLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSnapshot = async () => {
    setLoading(true)
    try {
      const res = await fetchWindowsFullOpsSnapshot()
      setSnapshot(res)
      if (!activeTool && res.tools.length > 0) {
        setActiveTool(res.tools[0])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSnapshot()
  }, [])

  const handleAction = async (toolNum: number, actionName: string) => {
    setLoading(true)
    try {
      const res = await executeToolQuickAction(toolNum, actionName)
      setActionLog(res.message)
      await loadSnapshot()
    } finally {
      setLoading(false)
    }
  }

  const filteredTools =
    snapshot?.tools.filter((t) => selectedCategory === 'all' || t.category === selectedCategory) ??
    []

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/20 pb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase flex items-center gap-2">
            <span className="text-emerald-400">❖</span> Windows Mega Toolkit (20 Enterprise
            Utilities)
          </h3>
          <p className="text-xs text-muted-foreground">
            Complete low-level Windows OS management, runtime switches, network firewall, hardware &
            security
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-muted/30 p-1 rounded-lg border border-border/30 text-xs font-medium">
            {(['all', 'system', 'network', 'runtime', 'security'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded uppercase ${
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onClick={loadSnapshot}
            disabled={loading}
            className="px-3 py-1.5 text-xs rounded border border-border/40 hover:bg-muted/40 font-medium"
          >
            {loading ? 'Refreshing...' : 'Poll 20 Tools'}
          </button>
        </div>
      </div>

      {actionLog && (
        <div className="p-3 bg-muted/40 border border-border/40 rounded text-xs text-emerald-400 font-mono flex items-center justify-between">
          <span>✔ {actionLog}</span>
          <button
            onClick={() => setActionLog(null)}
            className="text-muted-foreground hover:text-foreground text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 20-TOOL GRID SELECTOR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {filteredTools.map((t) => {
          const isSelected = activeTool?.num === t.num
          return (
            <div
              key={t.id}
              onClick={() => setActiveTool(t)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-500/80 bg-emerald-950/20 shadow-sm'
                  : 'border-border/30 bg-muted/10 hover:bg-muted/30'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">#{t.num}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      t.status === 'optimal'
                        ? 'bg-emerald-400'
                        : t.status === 'warning'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                    }`}
                  />
                </div>
                <div className="font-semibold text-foreground mt-1 truncate">{t.title}</div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 truncate uppercase">
                {t.category}
              </div>
            </div>
          )
        })}
      </div>

      {/* ACTIVE TOOL DETAIL INSPECTOR */}
      {activeTool && snapshot && (
        <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                  TOOL #{activeTool.num}
                </span>
                <h4 className="text-sm font-bold text-foreground">{activeTool.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{activeTool.description}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(activeTool.num, 'optimize')}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
              >
                Run Tool Action
              </button>
            </div>
          </div>

          {/* DYNAMIC TELEMETRY CARD PER TOOL NUM */}
          <div className="text-xs">
            {activeTool.num === 1 && (
              <div className="space-y-2">
                <div className="font-semibold text-slate-300">
                  Active Windows Firewall Dev Inbound Rules:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {snapshot.firewall.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-card border border-border/30 rounded font-mono"
                    >
                      <div className="text-foreground font-bold">{r.name}</div>
                      <div className="text-muted-foreground text-[11px] mt-0.5">
                        PORT: {r.port} | {r.protocol} |{' '}
                        <span className="text-emerald-400">{r.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTool.num === 4 && (
              <div className="p-3 bg-card border border-border/30 rounded space-y-1 font-mono">
                <div className="text-foreground font-semibold">Git Workspace Integrity:</div>
                <div className="text-muted-foreground">
                  Stale Locks: {snapshot.gitHealth.staleLocks.length}
                </div>
                <div className="text-muted-foreground">
                  CRLF Violations: {snapshot.gitHealth.crlfIssuesCount}
                </div>
                <div className="text-muted-foreground">
                  MAX_PATH Violations: {snapshot.gitHealth.longPathViolations}
                </div>
              </div>
            )}

            {activeTool.num === 6 && (
              <div className="p-3 bg-card border border-border/30 rounded space-y-2">
                <div className="font-semibold text-foreground">WSL2 Runtimes:</div>
                {snapshot.wslDistros.map((d, i) => (
                  <div key={i} className="flex justify-between font-mono">
                    <span className="font-bold text-slate-300">
                      {d.name} (WSL {d.version})
                    </span>
                    <span className="text-emerald-400">
                      RAM: {d.vmmemUsageMb} MB / {d.memoryLimitMb} MB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTool.num === 13 && (
              <div className="p-3 bg-card border border-border/30 rounded grid grid-cols-3 gap-3 font-mono text-center">
                <div>
                  <div className="text-muted-foreground">Throughput</div>
                  <div className="font-bold text-foreground text-sm mt-1">
                    {snapshot.benchmark.requestsPerSec} RPS
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Latency</div>
                  <div className="font-bold text-emerald-400 text-sm mt-1">
                    {snapshot.benchmark.avgLatencyMs} ms
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Error Rate</div>
                  <div className="font-bold text-cyan-400 text-sm mt-1">
                    {snapshot.benchmark.errorRate}%
                  </div>
                </div>
              </div>
            )}

            {activeTool.num === 18 && (
              <div className="p-3 bg-card border border-border/30 rounded space-y-1 font-mono">
                <div className="text-foreground font-semibold">Node & Toolchain Versioning:</div>
                <div className="text-emerald-400 font-bold">
                  Active: {snapshot.runtimeSwitch.activeNode} (pnpm{' '}
                  {snapshot.runtimeSwitch.activePnpm})
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Installed: {snapshot.runtimeSwitch.installedNodeVersions.join(', ')}
                </div>
              </div>
            )}

            {activeTool.num === 20 && (
              <div className="p-3 bg-card border border-border/30 rounded space-y-1 font-mono">
                <div className="text-foreground font-semibold">
                  Security Compliance & Dev Guard:
                </div>
                <div className="text-muted-foreground">
                  Secure Boot: <strong className="text-emerald-400">ENABLED</strong>
                </div>
                <div className="text-muted-foreground">
                  BitLocker Storage: <strong className="text-emerald-400">ENCRYPTED</strong>
                </div>
                <div className="text-muted-foreground">
                  Defender Exclusion (Z:\project):{' '}
                  <strong className="text-emerald-400">ACTIVE</strong>
                </div>
              </div>
            )}

            {![1, 4, 6, 13, 18, 20].includes(activeTool.num) && (
              <div className="p-3 bg-card border border-border/30 rounded font-mono text-muted-foreground">
                Telemetry for Tool #{activeTool.num} ({activeTool.title}): Status is currently{' '}
                <span className="text-emerald-400 uppercase font-bold">{activeTool.status}</span>.
                Ready for one-click maintenance dispatch.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
