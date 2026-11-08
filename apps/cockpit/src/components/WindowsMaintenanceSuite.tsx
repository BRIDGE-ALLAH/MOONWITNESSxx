'use client'

import React, { useState } from 'react'
import {
  scanWindowsCleanableTargets,
  executeWindowsClean,
  flushWindowsNetwork,
  optimizeWindowsMemory,
  scanZombieDevProcesses,
  terminateDevProcess,
  type CleanerScanResult,
  type CleanerExecutionResult,
  type NetworkFlushResult,
  type MemoryOptimizationResult,
  type ZombieProcessInfo,
} from '../lib/windowsTools'

export function WindowsMaintenanceSuite() {
  const [activeTab, setActiveTab] = useState<'cleaner' | 'network' | 'ram' | 'processes'>('cleaner')
  const [loading, setLoading] = useState(false)

  // 1. Cleaner state
  const [scanResult, setScanResult] = useState<CleanerScanResult | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [cleanResult, setCleanResult] = useState<CleanerExecutionResult | null>(null)

  // 2. Network state
  const [networkResult, setNetworkResult] = useState<NetworkFlushResult | null>(null)

  // 3. RAM state
  const [ramResult, setRamResult] = useState<MemoryOptimizationResult | null>(null)

  // 4. Processes state
  const [zombieProcesses, setZombieProcesses] = useState<ZombieProcessInfo[]>([])
  const [killMessage, setKillMessage] = useState<string | null>(null)

  const handleScanCleaner = async () => {
    setLoading(true)
    setCleanResult(null)
    try {
      const res = await scanWindowsCleanableTargets()
      setScanResult(res)
      setSelectedCategories(res.categories.map((c) => c.id))
    } finally {
      setLoading(false)
    }
  }

  const handleClean = async (dryRun = false) => {
    if (selectedCategories.length === 0) return
    setLoading(true)
    try {
      const res = await executeWindowsClean(selectedCategories, dryRun)
      setCleanResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleFlushNetwork = async () => {
    setLoading(true)
    try {
      const res = await flushWindowsNetwork()
      setNetworkResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizeRam = async () => {
    setLoading(true)
    try {
      const res = await optimizeWindowsMemory()
      setRamResult(res)
    } finally {
      setLoading(false)
    }
  }

  const handleScanProcesses = async () => {
    setLoading(true)
    setKillMessage(null)
    try {
      const res = await scanZombieDevProcesses()
      setZombieProcesses(res)
    } finally {
      setLoading(false)
    }
  }

  const handleKillProcess = async (proc: ZombieProcessInfo) => {
    setLoading(true)
    try {
      const res = await terminateDevProcess(proc.pid, proc.name)
      setKillMessage(res.message)
      setZombieProcesses((prev) => prev.filter((p) => p.pid !== proc.pid))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase flex items-center gap-2">
            <span className="text-cyan-400">❖</span> Windows Maintenance & System Suite
          </h3>
          <p className="text-xs text-muted-foreground">
            Native OS disk cleanup, DNS resolver purge, working set optimizer, and lingering port
            hunters
          </p>
        </div>
        <div className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-lg border border-border/30">
          {(['cleaner', 'network', 'ram', 'processes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded transition-colors uppercase font-medium ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'cleaner' && 'Disk Cleaner'}
              {tab === 'network' && 'DNS & Network'}
              {tab === 'ram' && 'RAM Optimizer'}
              {tab === 'processes' && 'Port / Zombie Hunter'}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: DISK CLEANER */}
      {activeTab === 'cleaner' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Safely inspect and purge %TEMP%, stale dev caches, and crash dumps.
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleScanCleaner}
                disabled={loading}
                className="px-3 py-1 text-xs rounded border border-border/50 hover:bg-muted/40 font-medium"
              >
                {loading ? 'Scanning...' : 'Scan Junk'}
              </button>
              {scanResult && (
                <>
                  <button
                    onClick={() => handleClean(true)}
                    disabled={loading || selectedCategories.length === 0}
                    className="px-3 py-1 text-xs rounded border border-sky-600/50 bg-sky-950/20 text-sky-400 hover:bg-sky-900/30"
                  >
                    Dry-Run Clean
                  </button>
                  <button
                    onClick={() => handleClean(false)}
                    disabled={loading || selectedCategories.length === 0}
                    className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium shadow-sm"
                  >
                    Purge Selected
                  </button>
                </>
              )}
            </div>
          </div>

          {scanResult ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground flex justify-between py-1">
                <span>
                  Total Cleanable:{' '}
                  <strong className="text-foreground">
                    {(scanResult.totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </strong>
                </span>
                <span>
                  Total Files: <strong className="text-foreground">{scanResult.totalFiles}</strong>
                </span>
              </div>
              <div className="space-y-1.5">
                {scanResult.categories.map((c) => {
                  const checked = selectedCategories.includes(c.id)
                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center justify-between text-xs"
                    >
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedCategories([...selectedCategories, c.id])
                            else
                              setSelectedCategories(selectedCategories.filter((id) => id !== c.id))
                          }}
                          className="mt-0.5 rounded"
                        />
                        <div>
                          <div className="font-semibold text-foreground">{c.name}</div>
                          <div className="text-muted-foreground text-[11px]">{c.description}</div>
                        </div>
                      </label>
                      <div className="text-right font-mono">
                        <div className="font-semibold text-cyan-400">
                          {(c.estimatedBytes / (1024 * 1024)).toFixed(1)} MB
                        </div>
                        <div className="text-[10px] text-muted-foreground">{c.fileCount} files</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
              Click &quot;Scan Junk&quot; to inspect Windows temporary directories and caches.
            </div>
          )}

          {cleanResult && (
            <div className="p-3 bg-muted/30 border border-border/40 rounded-lg space-y-1 text-xs font-mono">
              <div className="text-emerald-400 font-bold">
                ✔ Operation Complete: {(cleanResult.freedBytes / (1024 * 1024)).toFixed(1)} MB Freed
                ({cleanResult.removedFiles} files)
              </div>
              {cleanResult.details.map((d, i) => (
                <div key={i} className="text-muted-foreground text-[11px]">
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DNS & NETWORK */}
      {activeTab === 'network' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Flush Windows DNS resolver cache, refresh ARP table, and reset stale socket handles.
            </span>
            <button
              onClick={handleFlushNetwork}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm"
            >
              {loading ? 'Flushing...' : 'Flush DNS & Reset Sockets'}
            </button>
          </div>

          {networkResult && (
            <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-emerald-400 font-bold">✔ DNS FLUSH SUCCESS</span>
                <span className="text-muted-foreground">Latency: {networkResult.latencyMs} ms</span>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                {networkResult.output}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RAM OPTIMIZER */}
      {activeTab === 'ram' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Empty working set inactive pages & reclaim unreserved physical memory.
            </span>
            <button
              onClick={handleOptimizeRam}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            >
              {loading ? 'Optimizing...' : 'Reclaim Memory'}
            </button>
          </div>

          {ramResult && (
            <div className="p-4 bg-muted/20 border border-border/30 rounded-lg space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2 bg-card rounded border border-border/20">
                  <div className="text-muted-foreground">Previous Used</div>
                  <div className="font-mono font-bold text-slate-300 mt-1">
                    {ramResult.previousUsedMb} MB
                  </div>
                </div>
                <div className="p-2 bg-card rounded border border-border/20">
                  <div className="text-muted-foreground">Current Used</div>
                  <div className="font-mono font-bold text-emerald-400 mt-1">
                    {ramResult.currentUsedMb} MB
                  </div>
                </div>
                <div className="p-2 bg-card rounded border border-border/20">
                  <div className="text-muted-foreground">Memory Freed</div>
                  <div className="font-mono font-bold text-cyan-400 mt-1">
                    +{ramResult.freedMb} MB
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROCESS & PORT HUNTER */}
      {activeTab === 'processes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Identify orphaned dev runtimes lingering on ports (3000, 3001, 3002, 4000, 4001, 5432,
              8000).
            </span>
            <button
              onClick={handleScanProcesses}
              disabled={loading}
              className="px-3 py-1 text-xs rounded border border-border/50 hover:bg-muted/40 font-medium"
            >
              {loading ? 'Scanning Ports...' : 'Scan Lingering Ports'}
            </button>
          </div>

          {killMessage && (
            <div className="p-2.5 bg-emerald-950/20 border border-emerald-800/40 rounded text-xs text-emerald-400 font-mono">
              ✔ {killMessage}
            </div>
          )}

          {zombieProcesses.length > 0 ? (
            <div className="space-y-2">
              {zombieProcesses.map((proc) => (
                <div
                  key={proc.pid}
                  className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground font-mono flex items-center gap-2">
                      <span>{proc.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        PID: {proc.pid}
                      </span>
                      {proc.port && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                          PORT :{proc.port}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">
                      Memory: {proc.memoryMb} MB • CPU: {proc.cpuPercent}%
                    </div>
                  </div>
                  <button
                    onClick={() => handleKillProcess(proc)}
                    disabled={loading}
                    className="px-2.5 py-1 text-xs rounded bg-red-600/80 hover:bg-red-600 text-white font-medium"
                  >
                    Kill Process
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg">
              No lingering dev zombie processes detected on monitored ports.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
