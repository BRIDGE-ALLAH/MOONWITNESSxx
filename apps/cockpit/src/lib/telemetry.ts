import { isTauri, invoke } from './tauri.ts'
import {
  getNodeProbeDefs,
  resolveEnvironment,
  type ProbeKind as EnvProbeKind,
} from './envConfig.ts'

export type ProbeKind = EnvProbeKind
export type NodeStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE'

export interface ProbeTelemetry {
  status: NodeStatus
  latencyMs: number
  target: string
  ok: boolean
  error?: string
  kind?: ProbeKind
}

export interface NodeTelemetry {
  id: string
  name: string
  category: string
  port?: number | string
  status: NodeStatus
  latencyMs: number
  uptime?: string
  load?: string
  probe: ProbeTelemetry
  source: 'backend' | 'frontend' | 'static'
  timestamp: string
}

export interface CockpitSnapshot {
  timestamp: string
  environment: string
  targetHost: string
  probe: ProbeTelemetry
  nodes: NodeTelemetry[]
  recentLogs: { text: string }[]
  source: 'backend' | 'frontend'
}

function arsyFallbackProbe(nodes: ReturnType<typeof getNodeProbeDefs>): ProbeTelemetry {
  const arsy = nodes.find((n) => n.id === 'arsy')
  return {
    status: 'OFFLINE',
    latencyMs: 0,
    target: arsy?.target ?? 'http://localhost:4000/health/live',
    ok: false,
    error: 'missing',
    kind: 'http',
  }
}

export async function fetchCockpitTelemetry(environment: string): Promise<CockpitSnapshot> {
  // Frontend resolves unknown envs safely (audited/degraded behavior, never undefined).
  const env = resolveEnvironment(environment)
  if (isTauri()) {
    try {
      const snap = await invoke<CockpitSnapshot>('get_cockpit_telemetry', { environment: env })
      return { ...snap, source: snap.source ?? 'backend' }
    } catch {
      // fall through to frontend probes when backend command unavailable
    }
  }
  const ts = new Date().toISOString()
  const nodes: NodeTelemetry[] = []
  const defs = getNodeProbeDefs(env)
  for (const n of defs) {
    if (n.kind === 'http') {
      const start = performance.now()
      let status: NodeStatus = 'OFFLINE'
      let ok = false
      let error: string | undefined
      let latency = 0
      try {
        const res = await fetch(n.target, { signal: AbortSignal.timeout(n.timeoutMs) })
        latency = Math.round(performance.now() - start)
        ok = res.ok
        status = res.ok ? 'HEALTHY' : 'WARNING'
      } catch (e: any) {
        latency = Math.round(performance.now() - start)
        error = e?.message ?? 'error'
        status = 'OFFLINE'
      }
      nodes.push({
        id: n.id,
        name: n.name,
        category: n.category,
        port: n.port,
        status,
        latencyMs: latency,
        uptime: ok ? '99.99%' : '0.00%',
        load: 'n/a',
        probe: { status, latencyMs: latency, target: n.target, ok, error, kind: 'http' },
        source: 'frontend',
        timestamp: ts,
      })
    } else {
      nodes.push({
        id: n.id,
        name: n.name,
        category: n.category,
        port: n.port,
        status: 'OFFLINE',
        latencyMs: 0,
        uptime: 'n/a',
        load: 'n/a',
        probe: {
          status: 'OFFLINE',
          latencyMs: 0,
          target: n.target,
          ok: false,
          error: 'tcp probe unavailable in web',
          kind: 'tcp',
        },
        source: 'frontend',
        timestamp: ts,
      })
    }
  }
  const arsy = nodes.find((n) => n.id === 'arsy')
  return {
    timestamp: ts,
    environment: env,
    targetHost: env,
    probe: arsy?.probe ?? arsyFallbackProbe(defs),
    nodes,
    recentLogs: [],
    source: 'frontend',
  }
}
