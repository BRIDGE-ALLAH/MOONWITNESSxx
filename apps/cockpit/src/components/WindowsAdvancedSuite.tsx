'use client'

import React, { useEffect, useState } from 'react'
import {
  fetchWindowsServices,
  controlWindowsService,
  auditEnvironmentPath,
  fetchHostsEntries,
  updateHostEntry,
  fetchHardwareHealth,
  type WindowsServiceInfo,
  type EnvironmentAuditReport,
  type HostsConfig,
  type HardwareMetrics,
} from '../lib/windowsAdvanced'

export function WindowsAdvancedSuite() {
  const [subTab, setSubTab] = useState<'services' | 'path' | 'hosts' | 'hardware'>('services')
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // 1. Services state
  const [services, setServices] = useState<WindowsServiceInfo[]>([])

  // 2. Path Audit state
  const [pathReport, setPathReport] = useState<EnvironmentAuditReport | null>(null)

  // 3. Hosts state
  const [hostsConfig, setHostsConfig] = useState<HostsConfig | null>(null)

  // 4. Hardware state
  const [hardware, setHardware] = useState<HardwareMetrics | null>(null)

  useEffect(() => {
    // Initial load
    fetchWindowsServices()
      .then(setServices)
      .catch(() => {})
  }, [])

  const loadServices = async () => {
    setLoading(true)
    try {
      const res = await fetchWindowsServices()
      setServices(res)
    } finally {
      setLoading(false)
    }
  }

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setLoading(true)
    try {
      const res = await controlWindowsService(serviceName, action)
      setStatusMessage(res.message)
      await loadServices()
    } finally {
      setLoading(false)
    }
  }

  const loadPathAudit = async () => {
    setLoading(true)
    try {
      const res = await auditEnvironmentPath()
      setPathReport(res)
    } finally {
      setLoading(false)
    }
  }

  const loadHosts = async () => {
    setLoading(true)
    try {
      const res = await fetchHostsEntries()
      setHostsConfig(res)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleHost = async (hostname: string, currentEnabled: boolean) => {
    setLoading(true)
    try {
      const res = await updateHostEntry(hostname, !currentEnabled)
      setStatusMessage(res.message)
      await loadHosts()
    } finally {
      setLoading(false)
    }
  }

  const loadHardware = async () => {
    setLoading(true)
    try {
      const res = await fetchHardwareHealth()
      setHardware(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/20 pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase flex items-center gap-2">
            <span className="text-amber-400">⚡</span> Windows Services, Toolchain & Hardware Engine
          </h3>
          <p className="text-xs text-muted-foreground">
            Windows daemons, PATH integrity auditor, hosts local resolver, and hardware sensors
          </p>
        </div>
        <div className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-lg border border-border/30">
          {(['services', 'path', 'hosts', 'hardware'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setSubTab(tab)
                if (tab === 'services') loadServices()
                if (tab === 'path') loadPathAudit()
                if (tab === 'hosts') loadHosts()
                if (tab === 'hardware') loadHardware()
              }}
              className={`px-3 py-1 text-xs rounded transition-colors uppercase font-medium ${
                subTab === tab
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'services' && 'Services'}
              {tab === 'path' && 'PATH / Toolchains'}
              {tab === 'hosts' && 'Hosts & DNS'}
              {tab === 'hardware' && 'Hardware Sensors'}
            </button>
          ))}
        </div>
      </div>

      {statusMessage && (
        <div className="p-2.5 bg-muted/40 border border-border/40 rounded text-xs text-cyan-400 font-mono">
          {statusMessage}
        </div>
      )}

      {/* 1. SERVICES CONTROLLER */}
      {subTab === 'services' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Control development database and runtime services (PostgreSQL, Docker, Redis, WSL2).
            </span>
            <button
              onClick={loadServices}
              disabled={loading}
              className="px-2.5 py-1 rounded border border-border/40 hover:bg-muted/40 font-medium"
            >
              Refresh Services
            </button>
          </div>

          <div className="space-y-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>{svc.displayName}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        svc.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {svc.status.toUpperCase()}
                    </span>
                    {svc.pid && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (PID {svc.pid})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    Service: {svc.name} • Startup: {svc.startupType} • Category: {svc.category}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {svc.status === 'running' ? (
                    <>
                      <button
                        onClick={() => handleServiceAction(svc.name, 'restart')}
                        disabled={loading}
                        className="px-2 py-1 rounded border border-border/40 hover:bg-muted/50 text-[11px]"
                      >
                        Restart
                      </button>
                      <button
                        onClick={() => handleServiceAction(svc.name, 'stop')}
                        disabled={loading}
                        className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white text-[11px]"
                      >
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleServiceAction(svc.name, 'start')}
                      disabled={loading}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px]"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. PATH & TOOLCHAINS AUDIT */}
      {subTab === 'path' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Audit system and user environment PATH for broken dirs, duplicates, and runtime SDKs.
            </span>
            <button
              onClick={loadPathAudit}
              disabled={loading}
              className="px-2.5 py-1 rounded border border-border/40 hover:bg-muted/40 font-medium"
            >
              Re-scan PATH
            </button>
          </div>

          {pathReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-muted/20 border border-border/30 rounded">
                  <div className="text-muted-foreground">Total Entries</div>
                  <div className="font-bold text-foreground mt-1">{pathReport.totalPaths}</div>
                </div>
                <div className="p-2.5 bg-muted/20 border border-border/30 rounded">
                  <div className="text-muted-foreground">Valid Directories</div>
                  <div className="font-bold text-emerald-400 mt-1">{pathReport.validPaths}</div>
                </div>
                <div className="p-2.5 bg-muted/20 border border-border/30 rounded">
                  <div className="text-muted-foreground">Broken Paths</div>
                  <div className="font-bold text-red-400 mt-1">{pathReport.brokenPaths}</div>
                </div>
                <div className="p-2.5 bg-muted/20 border border-border/30 rounded">
                  <div className="text-muted-foreground">Duplicates</div>
                  <div className="font-bold text-amber-400 mt-1">{pathReport.duplicatePaths}</div>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {pathReport.entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-muted/20 border border-border/20 rounded flex items-center justify-between text-xs font-mono"
                  >
                    <span className="truncate mr-2 text-slate-300">{entry.path}</span>
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      {entry.exists ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          VALID
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          MISSING
                        </span>
                      )}
                      {entry.isDuplicate && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          DUPLICATE
                        </span>
                      )}
                      {entry.toolchainType && (
                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                          {entry.toolchainType}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. HOSTS RESOLVER */}
      {subTab === 'hosts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Manage local domain aliases for microservices in{' '}
              <code className="text-slate-300">hosts</code>.
            </span>
            <button
              onClick={loadHosts}
              disabled={loading}
              className="px-2.5 py-1 rounded border border-border/40 hover:bg-muted/40 font-medium"
            >
              Reload Hosts
            </button>
          </div>

          {hostsConfig && (
            <div className="space-y-2">
              {hostsConfig.entries.map((entry) => (
                <div
                  key={entry.hostname}
                  className="p-3 bg-muted/20 border border-border/30 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground font-mono flex items-center gap-2">
                      <span>{entry.hostname}</span>
                      <span className="text-muted-foreground">➔ {entry.ip}</span>
                    </div>
                    {entry.comment && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {entry.comment}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleHost(entry.hostname, entry.enabled)}
                    disabled={loading}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      entry.enabled
                        ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30'
                        : 'bg-muted border border-border/40 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {entry.enabled ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. HARDWARE SENSORS & DRIVES */}
      {subTab === 'hardware' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Live hardware load metrics and NVMe / project drive storage status.</span>
            <button
              onClick={loadHardware}
              disabled={loading}
              className="px-2.5 py-1 rounded border border-border/40 hover:bg-muted/40 font-medium"
            >
              Poll Sensors
            </button>
          </div>

          {hardware && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
                  <div className="text-muted-foreground">CPU Core Load</div>
                  <div className="font-mono font-bold text-foreground text-sm mt-1">
                    {hardware.cpuUsagePercent}%
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
                  <div className="text-muted-foreground">CPU Temperature</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                    {hardware.cpuTempCelsius ? `${hardware.cpuTempCelsius} °C` : 'N/A'}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg">
                  <div className="text-muted-foreground">Storage I/O Speed</div>
                  <div className="font-mono font-bold text-cyan-400 text-sm mt-1">
                    {hardware.diskThroughputMbSec} MB/s
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Mounted Volumes</div>
                {hardware.drives.map((d) => (
                  <div
                    key={d.letter}
                    className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-1.5 text-xs"
                  >
                    <div className="flex justify-between font-mono">
                      <span className="font-bold text-foreground">
                        {d.letter} [{d.label}] ({d.filesystem})
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {(d.availableBytes / (1024 * 1024 * 1024)).toFixed(0)} GB free of{' '}
                        {(d.totalBytes / (1024 * 1024 * 1024)).toFixed(0)} GB ({d.percentFree}%
                        free)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${100 - d.percentFree}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
