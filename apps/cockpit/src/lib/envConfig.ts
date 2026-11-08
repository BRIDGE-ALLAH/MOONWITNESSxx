// Single source of truth for cockpit environment and node probe configuration.
// Frontend components and Rust `get_cockpit_telemetry` must stay aligned with
// these env ids, node ids, probe kinds, and targets. Contract tests enforce
// alignment via static assertions.

export type EnvironmentTarget = 'local' | 'development' | 'production'

export type ProbeKind = 'http' | 'tcp'

export interface NodeProbeDef {
  id: string
  name: string
  category: string
  port: number
  kind: ProbeKind
  target: string
  timeoutMs: number
}

export interface EnvironmentConfig {
  id: EnvironmentTarget
  label: string
  badgeColor: string
  baseUrls: {
    arsy: string
    oracle: string
    postgres: string
    radius: string
  }
  nodes: NodeProbeDef[]
}

export const ENVIRONMENT_IDS = [
  'local',
  'development',
  'production',
] as const satisfies readonly EnvironmentTarget[]

export const DEFAULT_ENVIRONMENT: EnvironmentTarget = 'local'

// Canonical node set (ids/kinds/names/categories/ports). Targets/timeouts may
// vary by environment; Rust mirrors these values in `env_nodes`.
export const ENVIRONMENTS: Record<EnvironmentTarget, EnvironmentConfig> = {
  local: {
    id: 'local',
    label: 'LOCAL WORKSTATION',
    badgeColor: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    baseUrls: {
      arsy: 'http://localhost:4000',
      oracle: 'http://localhost:8000',
      postgres: 'localhost:5432',
      radius: 'localhost:1812',
    },
    nodes: [
      {
        id: 'arsy',
        name: 'ARSY CORE ORCHESTRATOR',
        category: 'core',
        port: 4000,
        kind: 'http',
        target: 'http://localhost:4000/health/live',
        timeoutMs: 1500,
      },
      {
        id: 'oracle',
        name: 'ORACLE PYTHON ENGINE',
        category: 'analytics',
        port: 8000,
        kind: 'http',
        target: 'http://localhost:8000/health/live',
        timeoutMs: 1500,
      },
      {
        id: 'postgres',
        name: 'POSTGRESQL PRIMARY CLUSTER',
        category: 'database',
        port: 5432,
        kind: 'tcp',
        target: 'localhost:5432',
        timeoutMs: 1500,
      },
      {
        id: 'radius',
        name: 'ATLAS FREERADIUS RUNTIME',
        category: 'network',
        port: 1812,
        kind: 'tcp',
        target: 'localhost:1812',
        timeoutMs: 1500,
      },
    ],
  },
  development: {
    id: 'development',
    label: 'DEV STAGING CLUSTER',
    badgeColor: 'bg-sky-500/10 border-sky-500/40 text-sky-400',
    baseUrls: {
      arsy: 'https://dev-api.moonwitness.internal',
      oracle: 'https://dev-oracle.moonwitness.internal',
      postgres: 'dev-db.moonwitness.internal:5432',
      radius: 'dev-radius.moonwitness.internal:1812',
    },
    nodes: [
      {
        id: 'arsy',
        name: 'ARSY CORE ORCHESTRATOR',
        category: 'core',
        port: 4000,
        kind: 'http',
        target: 'http://localhost:4000/health/live',
        timeoutMs: 2000,
      },
      {
        id: 'oracle',
        name: 'ORACLE PYTHON ENGINE',
        category: 'analytics',
        port: 8000,
        kind: 'http',
        target: 'http://localhost:8000/health/live',
        timeoutMs: 2000,
      },
      {
        id: 'postgres',
        name: 'POSTGRESQL PRIMARY CLUSTER',
        category: 'database',
        port: 5432,
        kind: 'tcp',
        target: 'localhost:5432',
        timeoutMs: 2000,
      },
      {
        id: 'radius',
        name: 'ATLAS FREERADIUS RUNTIME',
        category: 'network',
        port: 1812,
        kind: 'tcp',
        target: 'localhost:1812',
        timeoutMs: 2000,
      },
    ],
  },
  production: {
    id: 'production',
    label: 'PRODUCTION AIR-GAPPED',
    badgeColor: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
    baseUrls: {
      arsy: 'https://api.moonwitness.biz.id',
      oracle: 'https://oracle.moonwitness.biz.id',
      postgres: 'prod-db.moonwitness.biz.id:5432',
      radius: 'prod-radius.moonwitness.biz.id:1812',
    },
    nodes: [
      {
        id: 'arsy',
        name: 'ARSY CORE ORCHESTRATOR',
        category: 'core',
        port: 4000,
        kind: 'http',
        target: 'http://localhost:4000/health/live',
        timeoutMs: 3000,
      },
      {
        id: 'oracle',
        name: 'ORACLE PYTHON ENGINE',
        category: 'analytics',
        port: 8000,
        kind: 'http',
        target: 'http://localhost:8000/health/live',
        timeoutMs: 3000,
      },
      {
        id: 'postgres',
        name: 'POSTGRESQL PRIMARY CLUSTER',
        category: 'database',
        port: 5432,
        kind: 'tcp',
        target: 'localhost:5432',
        timeoutMs: 3000,
      },
      {
        id: 'radius',
        name: 'ATLAS FREERADIUS RUNTIME',
        category: 'network',
        port: 1812,
        kind: 'tcp',
        target: 'localhost:1812',
        timeoutMs: 3000,
      },
    ],
  },
}

export function isEnvironmentTarget(value: string): value is EnvironmentTarget {
  return (ENVIRONMENT_IDS as readonly string[]).includes(value)
}

/** Resolve an env string safely. Unknown envs fall back to DEFAULT_ENVIRONMENT (never undefined). */
export function resolveEnvironment(value: string | null | undefined): EnvironmentTarget {
  if (value && isEnvironmentTarget(value)) return value
  return DEFAULT_ENVIRONMENT
}

export function getEnvironmentConfig(env: string | null | undefined): EnvironmentConfig {
  return ENVIRONMENTS[resolveEnvironment(env)]
}

export function getNodeProbeDefs(env: string | null | undefined): NodeProbeDef[] {
  return getEnvironmentConfig(env).nodes
}
