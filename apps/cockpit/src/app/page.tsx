'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ServiceNodeGrid, type ServiceNode } from '../components/ServiceNodeGrid'
import { ActionControlPanel } from '../components/ActionControlPanel'
import {
  EnvironmentSelector,
  type EnvironmentTarget,
  ENVIRONMENTS,
} from '../components/EnvironmentSelector'
import { AgiCopilotPanel } from '../components/AgiCopilotPanel'
import { AuditTrail } from '../components/AuditTrail'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { RunbookPanel } from '../components/RunbookPanel'
import { TelemetryVisualizer } from '../components/TelemetryVisualizer'
import { GateDaemonBridgePanel } from '../components/GateDaemonBridgePanel'
import { PlaybookPipelineRunner } from '../components/PlaybookPipelineRunner'
import { WindowsMaintenanceSuite } from '../components/WindowsMaintenanceSuite'
import { WindowsAdvancedSuite } from '../components/WindowsAdvancedSuite'
import { WindowsMegaToolkit } from '../components/WindowsMegaToolkit'
import type { CockpitSnapshot, SuggestedAction } from '../lib/agiCopilot'
import {
  fetchCockpitTelemetry,
  type CockpitSnapshot as TelemetrySnapshot,
  type NodeTelemetry,
} from '../lib/telemetry'
import { computeSnapshotDiff, type NodeChange } from '../lib/snapshotDiff'
import { useRef } from 'react'
import { isTauri } from '../lib/tauri'
import {
  auditCancelled,
  auditConfirmed,
  auditRequested,
  executeGovernedDiagnostic,
  type ActionId,
} from '../lib/actions'

const INITIAL_LOGS = [
  '[INIT] Cockpit dashboard mounted',
  '[NOC] Telemetry polling scheduled (3s)',
  '[SEC] Dispatch requires explicit confirmation; no real system execution',
]

const TRUST_FRESH_THRESHOLD_MS = 6000
const TRUST_STALE_THRESHOLD_MS = 15000
const TELEMETRY_POLL_INTERVAL_MS = 3000

type ActionSource = 'operator' | 'copilot-draft'

interface PendingAction {
  actionId: ActionId
  source: ActionSource
  correlationId: string
}

function nowLabel(): string {
  return new Date().toLocaleTimeString()
}

function addLog(setLogs: React.Dispatch<React.SetStateAction<string[]>>, message: string) {
  setLogs((prev) => [`[${nowLabel()}] ${message}`, ...prev].slice(0, 1000))
}

function mapNode(node: NodeTelemetry): ServiceNode {
  return {
    id: node.id,
    name: node.name,
    category: node.category,
    port: node.port,
    status: node.status,
    latencyMs: node.latencyMs,
    uptime: node.uptime ?? 'n/a',
    load: node.load ?? 'n/a',
    probe: node.probe,
    source: node.source,
    timestamp: node.timestamp,
  }
}

function toCopilotSnapshot(
  selectedEnv: EnvironmentTarget,
  telemetry: TelemetrySnapshot | null,
  logs: string[]
): CockpitSnapshot {
  if (telemetry) {
    return {
      timestamp: telemetry.timestamp,
      environment: selectedEnv,
      targetHost: ENVIRONMENTS[selectedEnv].label,
      probe: {
        status:
          telemetry.probe.status === 'HEALTHY' || telemetry.probe.status === 'OFFLINE'
            ? telemetry.probe.status
            : telemetry.probe.ok
              ? 'HEALTHY'
              : 'OFFLINE',
        latencyMs: telemetry.probe.latencyMs,
        target: telemetry.probe.target,
        ok: telemetry.probe.ok,
        error: telemetry.probe.error,
      },
      nodes: telemetry.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        category: n.category,
        port: n.port,
        status: n.status,
        latencyMs: n.latencyMs,
        uptime: n.uptime ?? 'n/a',
        load: n.load ?? 'n/a',
      })),
      recentLogs: logs.slice(0, 20).map((text) => ({ text })),
      source: telemetry.source,
    }
  }
  return {
    timestamp: new Date().toISOString(),
    environment: selectedEnv,
    targetHost: ENVIRONMENTS[selectedEnv].label,
    probe: {
      status: 'OFFLINE',
      latencyMs: 0,
      target: 'telemetry:pending',
      ok: false,
      error: 'No telemetry snapshot yet',
    },
    nodes: [],
    recentLogs: logs.slice(0, 20).map((text) => ({ text })),
    source: 'frontend',
  }
}

export default function CockpitDashboard() {
  const [selectedEnv, setSelectedEnv] = useState<EnvironmentTarget>('local')
  const [logs, setLogs] = useState<string[]>(INITIAL_LOGS)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null)
  const [telemetryError, setTelemetryError] = useState<string | null>(null)
  const [lastSuccessfulPollAt, setLastSuccessfulPollAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeChanges, setNodeChanges] = useState<NodeChange[]>([])
  const prevNodesRef = useRef<NodeTelemetry[] | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [auditRefreshToken, setAuditRefreshToken] = useState(0)

  useEffect(() => {
    if (!copilotOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCopilotOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [copilotOpen])

  useEffect(() => {
    let active = true
    let inFlight = false

    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const snap = await fetchCockpitTelemetry(selectedEnv)
        if (!active) return
        setTelemetry(snap)
        setTelemetryError(null)
        setLastSuccessfulPollAt(Date.now())
        const diff = computeSnapshotDiff(
          prevNodesRef.current?.map((n) => ({
            id: n.id,
            name: n.name,
            status: n.status,
            source: n.source,
            latencyMs: n.latencyMs,
          })),
          snap.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            status: n.status,
            source: n.source,
            latencyMs: n.latencyMs,
          }))
        )
        setNodeChanges(diff.changes)
        prevNodesRef.current = snap.nodes
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : String(error)
        setTelemetryError(message)
        addLog(setLogs, `TELEMETRY_ERROR: ${message}`)
      } finally {
        inFlight = false
      }
    }

    void poll()
    const interval = setInterval(() => void poll(), 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [selectedEnv])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const envConfig = ENVIRONMENTS[selectedEnv]
  const nodes: ServiceNode[] = useMemo(
    () => (telemetry ? telemetry.nodes.map(mapNode) : []),
    [telemetry]
  )
  const snapshot = useMemo(
    () => toCopilotSnapshot(selectedEnv, telemetry, logs),
    [logs, selectedEnv, telemetry]
  )

  const arsyStatus = telemetry?.probe.status === 'HEALTHY' ? 'HEALTHY' : 'OFFLINE'
  const pingLatency = telemetry?.probe.latencyMs ?? 0
  const probeLabel =
    telemetry == null
      ? 'POLLING'
      : telemetry.probe.ok
        ? 'LIVE CONNECTED'
        : selectedEnv === 'local'
          ? 'BACKEND OFFLINE'
          : 'DEGRADED'

  const refreshAudit = () => setAuditRefreshToken((n) => n + 1)

  const requestAction = useCallback(
    (actionId: ActionId, source: ActionSource, correlationId?: string) => {
      const cid = correlationId ?? crypto.randomUUID()
      setPendingAction({ actionId, source, correlationId: cid })
      void auditRequested(actionId, source, selectedEnv, cid).then(refreshAudit)
      addLog(setLogs, `ACTION_REQUESTED: ${actionId} (${source})`)
      return false
    },
    [selectedEnv]
  )

  const handleDispatch = useCallback(
    (actionId: ActionId, source: ActionSource = 'operator') => requestAction(actionId, source),
    [requestAction]
  )

  const handleDraftAction = useCallback(
    (action: SuggestedAction, correlationId?: string) => {
      addLog(setLogs, `COPILOT_DRAFT: ${action.actionId} requested confirmation`)
      requestAction(action.actionId, 'copilot-draft', correlationId)
      setCopilotOpen(true)
    },
    [requestAction]
  )

  const handleConfirm = useCallback(() => {
    if (!pendingAction) return
    const { actionId, source, correlationId } = pendingAction
    setPendingAction(null)
    void (async () => {
      if (actionId === 'DIAGNOSTIC_HEALTH_CHECK' && isTauri()) {
        const result = await executeGovernedDiagnostic(actionId)
        if (result.ok) {
          await auditConfirmed(actionId, source, selectedEnv, correlationId, {
            mode: 'read-only-executed',
            outcome: 'executed',
            command: 'run_diagnostic_health_check',
            detail: 'governed read-only desktop diagnostic completed',
            data: result.data,
          })
          addLog(
            setLogs,
            `${source === 'copilot-draft' ? 'COPILOT_DRAFT' : 'OPERATOR_ACTION'}: ${actionId} read-only executed (desktop/Tauri) — host=${String(result.data.host ?? '?')} mem=${String(result.data.memoryUsedMb ?? '?')}/${String(result.data.memoryTotalMb ?? '?')}MB procs=${String(result.data.processCount ?? '?')}`
          )
        } else {
          await auditConfirmed(actionId, source, selectedEnv, correlationId, {
            mode: 'read-only-executed',
            outcome: 'error',
            command: 'run_diagnostic_health_check',
            detail: result.error,
          })
          addLog(setLogs, `ERROR: ${actionId} read-only execution failed — ${result.error}`)
        }
      } else {
        await auditConfirmed(actionId, source, selectedEnv, correlationId, { mode: 'intent-only' })
        const webNote =
          actionId === 'DIAGNOSTIC_HEALTH_CHECK' && !isTauri() ? ' (web mode; intent-only)' : ''
        addLog(
          setLogs,
          `${source === 'copilot-draft' ? 'COPILOT_DRAFT' : 'OPERATOR_ACTION'}: ${actionId} confirmed (intent recorded; no execution${webNote})`
        )
      }
      refreshAudit()
    })()
  }, [pendingAction, selectedEnv])

  const handleCancel = useCallback(() => {
    if (!pendingAction) return
    const { actionId, source, correlationId } = pendingAction
    setPendingAction(null)
    void auditCancelled(actionId, source, selectedEnv, correlationId).then(refreshAudit)
    addLog(setLogs, `CANCELLED: ${actionId} (${source})`)
  }, [pendingAction, selectedEnv])

  const stale = telemetry ? Date.now() - Date.parse(telemetry.timestamp) > 10_000 : false
  const dataAgeMs = telemetry ? now - Date.parse(telemetry.timestamp) : 0
  const dataAgeSec = Math.max(0, Math.round(dataAgeMs / 1000))
  const freshnessState =
    lastSuccessfulPollAt == null
      ? 'disconnected'
      : dataAgeMs <= TRUST_FRESH_THRESHOLD_MS
        ? 'fresh'
        : dataAgeMs <= TRUST_STALE_THRESHOLD_MS
          ? 'stale'
          : 'disconnected'
  const nextRefreshIn = Math.max(
    0,
    Math.ceil((TELEMETRY_POLL_INTERVAL_MS - (now - (lastSuccessfulPollAt ?? now))) / 1000)
  )
  const webDegraded = !isTauri() || telemetry?.source === 'frontend'

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 md:p-8">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-cyan-500/40 bg-cyan-950/60 font-mono text-lg font-bold text-cyan-400">
            CP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-slate-500">
                Operations Flight Deck
              </span>
              <span className="rounded border border-cyan-800/40 bg-cyan-950/40 px-2 py-0.5 text-[10px] text-cyan-300">
                DESKTOP NOC
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">MOONWITNESS COCKPIT</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <EnvironmentSelector currentEnv={selectedEnv} onSelect={setSelectedEnv} />

          <a
            href="/release"
            className="min-h-[44px] rounded border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-xs font-mono font-bold text-amber-200 transition hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            RIOT RELEASE
          </a>

          <button
            type="button"
            onClick={() => setCopilotOpen((v) => !v)}
            aria-expanded={copilotOpen}
            aria-controls="agi-copilot-panel"
            className="min-h-[44px] rounded border border-cyan-700/50 bg-cyan-950/30 px-3 py-2 text-xs font-mono text-cyan-200 transition hover:bg-cyan-900/40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {copilotOpen ? 'Close AI Copilot' : 'Open AI Copilot'}
          </button>

          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-1.5">
            <span className="text-slate-500">TARGET HOST:</span>
            <span className="font-bold text-cyan-400">{envConfig.label}</span>
          </div>
          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-1.5">
            <span className="text-slate-500">PROBE:</span>
            <span
              className={`font-bold ${arsyStatus === 'HEALTHY' ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {probeLabel}
            </span>
            <span className="text-slate-500">({pingLatency}ms)</span>
          </div>
          <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-1.5">
            <span className="text-slate-500">SOURCE:</span>
            <span className="font-bold text-slate-200">{telemetry?.source ?? 'pending'}</span>
            {stale ? <span className="text-amber-300">STALE</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-[11px]">
            <span className="text-slate-500">TRUST STRIP:</span>
            <span>source={telemetry?.source ?? 'pending'}</span>
            <span>ts={telemetry?.timestamp ?? 'n/a'}</span>
            <span>age={dataAgeSec}s</span>
            <span>freshness={freshnessState}</span>
            <span>
              lastOk=
              {lastSuccessfulPollAt ? new Date(lastSuccessfulPollAt).toLocaleTimeString() : 'none'}
            </span>
            <span>nextRefresh~{nextRefreshIn}s</span>
          </div>
        </div>
      </header>

      {webDegraded ? (
        <div className="mb-4 rounded border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-100">
          DEGRADED WEB MODE: running without full Tauri desktop fidelity. TCP probes are unavailable
          in web and may appear OFFLINE/unavailable (web limitation), not necessarily service
          offline. Use desktop/Tauri for full fidelity.
        </div>
      ) : null}

      <main id="main-content" className="space-y-8">
        {telemetryError ? (
          <div className="rounded border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-200">
            Telemetry fetch error (last known snapshot retained when available): {telemetryError}
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Cluster Node Matrix ({envConfig.label})
            </h2>
            <span className="font-mono text-[11px] text-slate-500">
              Auto-probe: 3s Interval{telemetry ? ` • ${telemetry.timestamp}` : ''}
            </span>
          </div>
          {nodes.length > 0 ? (
            <ServiceNodeGrid
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />
          ) : (
            <div className="rounded border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
              Awaiting telemetry snapshot…
            </div>
          )}
          {nodeChanges.length > 0 ? (
            <div className="mt-3 rounded border border-slate-700 bg-slate-900/60 p-3 text-xs font-mono text-slate-200">
              <div className="mb-2 font-bold text-slate-300">
                What changed (since last snapshot)
              </div>
              <ul className="space-y-1">
                {nodeChanges.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(c.nodeId)}
                      className="text-cyan-300 hover:underline focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      {c.name ?? c.nodeId}
                    </button>
                    : {c.kind} {String(c.from)} → {String(c.to)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {telemetry ? (
          <RunbookPanel
            snapshot={telemetry}
            onDispatchDraft={(actionId) => requestAction(actionId, 'copilot-draft')}
          />
        ) : null}

        <TelemetryVisualizer
          nodes={telemetry?.nodes ?? []}
          diffs={nodeChanges}
          environment={selectedEnv}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GateDaemonBridgePanel />
          <PlaybookPipelineRunner />
        </div>

        <WindowsMaintenanceSuite />

        <WindowsAdvancedSuite />

        <WindowsMegaToolkit />

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Dispatch and Event Stream
            </h2>
            <span className="font-mono text-[11px] text-slate-500">
              Target: {envConfig.baseUrls.arsy}
            </span>
          </div>
          <ActionControlPanel logs={logs} onDispatch={handleDispatch} />
        </div>

        <AuditTrail refreshToken={auditRefreshToken} />
      </main>

      <footer className="mt-8 flex flex-col items-center justify-between border-t border-slate-800/80 pt-4 font-mono text-[11px] text-slate-500 sm:flex-row">
        <div>
          MOONWITNESS COCKPIT. Operator Context: {selectedEnv.toUpperCase()}. Do not expose
          publicly.
        </div>
        <div>BRIDGE-ALLAH / RIOTWORKS</div>
      </footer>

      <ConfirmationDialog
        actionId={pendingAction?.actionId ?? null}
        source={pendingAction?.source ?? 'operator'}
        environment={selectedEnv}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <div id="agi-copilot-panel">
        <AgiCopilotPanel
          open={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          snapshot={snapshot}
          onDraftAction={handleDraftAction}
        />
      </div>
    </div>
  )
}
