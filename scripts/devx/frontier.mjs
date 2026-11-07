import { createHash } from 'node:crypto'

const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/
const ACTIONS = new Set(['read', 'write', 'create', 'update', 'delete', 'publish', 'notify', 'webhook', 'charge'])

function list(value, label) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(label + ' must be an array of non-empty strings')
  }
  return [...new Set(value.map((item) => item.trim()))].sort()
}

function pathOverlaps(left, right) {
  const a = left.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
  const b = right.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/')
}

function pairKey(a, b) {
  return [a, b].sort().join('::')
}

/** Recommend a bounded execution topology; this function never launches agents. */
export function planAdaptiveSwarm({ agents, maxParallel = 2 } = {}) {
  if (!Array.isArray(agents) || agents.length === 0 || agents.length > 32) {
    throw new Error('agents must contain between 1 and 32 entries')
  }
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 8) {
    throw new Error('maxParallel must be an integer between 1 and 8')
  }
  const ids = new Set()
  const normalized = agents.map((agent) => {
    if (!agent || typeof agent.id !== 'string' || !ID.test(agent.id)) throw new Error('each agent needs a safe id')
    if (ids.has(agent.id)) throw new Error('duplicate agent id: ' + agent.id)
    ids.add(agent.id)
    return {
      id: agent.id,
      writePaths: list(agent.writePaths, 'writePaths'),
      resources: list(agent.resources, 'resources'),
      provides: list(agent.provides, 'provides').map((item) => item.toLowerCase()),
      consumes: list(agent.consumes, 'consumes').map((item) => item.toLowerCase()),
    }
  }).sort((a, b) => a.id.localeCompare(b.id))

  const edges = new Map()
  const add = (a, b, kind, detail) => {
    const key = pairKey(a, b)
    const current = edges.get(key) ?? { agents: key.split('::'), kinds: [], details: [] }
    if (!current.kinds.includes(kind)) current.kinds.push(kind)
    current.details.push(detail)
    edges.set(key, current)
  }
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i], b = normalized[j]
      for (const left of a.writePaths) for (const right of b.writePaths) {
        if (pathOverlaps(left, right)) add(a.id, b.id, 'write-overlap', [left, right].sort().join(' <> '))
      }
      for (const resource of a.resources.filter((item) => b.resources.includes(item))) add(a.id, b.id, 'shared-resource', resource)
      for (const contract of a.provides.filter((item) => b.consumes.includes(item))) add(a.id, b.id, 'interface-coupling', contract)
      for (const contract of b.provides.filter((item) => a.consumes.includes(item))) add(a.id, b.id, 'interface-coupling', contract)
    }
  }
  const interactions = [...edges.values()].map((edge) => ({
    ...edge,
    kinds: edge.kinds.sort(),
    details: [...new Set(edge.details)].sort(),
  })).sort((a, b) => a.agents.join('::').localeCompare(b.agents.join('::')))
  const hardConflicts = interactions.filter((item) => item.kinds.some((kind) => kind === 'write-overlap' || kind === 'shared-resource'))
  const coupledPairs = interactions.filter((item) => item.kinds.includes('interface-coupling'))

  let strategy, recommendedParallelism, rationale
  if (normalized.length === 1) {
    strategy = 'single-agent'
    recommendedParallelism = 1
    rationale = 'Only one agent is declared.'
  } else if (hardConflicts.length > 0) {
    strategy = 'serialize-conflicting-work'
    recommendedParallelism = 1
    rationale = 'Overlapping write paths or shared mutable resources require serialization or explicit isolation before parallel execution.'
  } else if (normalized.length === 2 && coupledPairs.length > 0) {
    strategy = 'peer-aware-pair'
    recommendedParallelism = 2
    rationale = 'Two agents have declared interface coupling but no detected write/resource collision; peer activity and contract changes should remain visible.'
  } else {
    strategy = 'isolated-parallel'
    recommendedParallelism = Math.min(maxParallel, normalized.length)
    rationale = 'No declared write/resource conflicts; use isolated workspaces and a conservative concurrency cap.'
  }
  return {
    schemaVersion: 1,
    strategy,
    recommendedParallelism,
    agentCount: normalized.length,
    interactions,
    hardConflictCount: hardConflicts.length,
    coupledPairCount: coupledPairs.length,
    rationale,
    advisoryOnly: true,
    note: 'This is a static recommendation. It does not create worktrees, reserve resources, observe live commits, or enforce isolation. Undeclared dependencies remain invisible.',
  }
}

const RISK_PENALTIES = { low: 0, medium: 15, high: 35, critical: 100 }
const SIGNAL_PENALTIES = { unverifiedWrites: 12, evidenceDebt: 8, interfaceDrift: 15, collisions: 20 }

/** Compute a reversible autonomy recommendation; never grants merge/deploy authority. */
export function assessAutonomyBudget({ risk = 'medium', signals = {} } = {}) {
  if (!Object.hasOwn(RISK_PENALTIES, risk)) throw new Error('risk must be low, medium, high or critical')
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) throw new Error('signals must be an object')
  for (const name of Object.keys(signals)) {
    if (!Object.hasOwn(SIGNAL_PENALTIES, name)) throw new Error('unknown autonomy signal: ' + name)
  }
  let penalty = RISK_PENALTIES[risk]
  const deductions = []
  for (const [name, weight] of Object.entries(SIGNAL_PENALTIES)) {
    const count = signals[name] ?? 0
    if (!Number.isInteger(count) || count < 0 || count > 1000) throw new Error(name + ' must be an integer between 0 and 1000')
    const amount = Math.min(60, count * weight)
    penalty += amount
    if (amount) deductions.push({ signal: name, count, points: amount })
  }
  const score = Math.max(0, Math.min(100, 100 - penalty))
  let level, capabilities
  if (risk === 'critical' || score < 25) {
    level = 'observe-only'
    capabilities = ['read']
  } else if (score < 50 || risk === 'high') {
    level = 'propose-only'
    capabilities = ['read', 'propose']
  } else if (score < 80) {
    level = 'write-with-review'
    capabilities = ['read', 'propose', 'write']
  } else {
    level = 'execute-scoped'
    capabilities = ['read', 'propose', 'write', 'run-tests']
  }
  return {
    schemaVersion: 1,
    risk,
    score,
    level,
    capabilities,
    deductions,
    prohibitedCapabilities: ['merge', 'deploy', 'read-secrets', 'change-permissions', 'destructive-production-write'],
    requiresIndependentVerification: ['write', 'run-tests'].some((capability) => capabilities.includes(capability)),
    advisoryOnly: true,
    note: 'The score is a deterministic heuristic, not calibrated probability or an authorization decision. Enforcement must occur in a trusted server-side policy boundary.',
  }
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

/** Compile a bounded, data-only incident replay seed and fault variants. */
export function compileIncidentRegression({ incident, now = '2000-01-01T00:00:00.000Z' } = {}) {
  if (!incident || typeof incident !== 'object' || Array.isArray(incident)) throw new Error('incident must be an object')
  if (typeof incident.id !== 'string' || !ID.test(incident.id)) throw new Error('incident needs a safe id')
  if (!Array.isArray(incident.operations) || incident.operations.length === 0 || incident.operations.length > 100) {
    throw new Error('incident.operations must contain between 1 and 100 entries')
  }
  const operations = new Map()
  for (const operation of incident.operations) {
    if (!operation || typeof operation.id !== 'string' || !ID.test(operation.id)) throw new Error('each operation needs a safe id')
    if (operations.has(operation.id)) throw new Error('duplicate operation id: ' + operation.id)
    if (!ACTIONS.has(operation.action)) throw new Error('unsupported action for operation ' + operation.id)
    operations.set(operation.id, {
      id: operation.id,
      action: operation.action,
      dependsOn: list(operation.dependsOn, 'dependsOn'),
      invariants: list(operation.invariants, 'invariants'),
    })
  }
  for (const operation of operations.values()) {
    for (const dependency of operation.dependsOn) {
      if (!operations.has(dependency)) throw new Error('unknown operation dependency: ' + dependency)
    }
  }
  const selected = incident.selectedOperationIds === undefined
    ? [...operations.keys()]
    : list(incident.selectedOperationIds, 'selectedOperationIds')
  if (selected.length === 0) throw new Error('selectedOperationIds must not be empty')
  const included = new Set()
  const include = (id) => {
    const operation = operations.get(id)
    if (!operation) throw new Error('unknown operation dependency: ' + id)
    if (included.has(id)) return
    included.add(id)
    for (const dependency of operation.dependsOn) include(dependency)
  }
  for (const id of selected) include(id)

  const visiting = new Set(), visited = new Set(), ordered = []
  const visit = (id) => {
    if (visiting.has(id)) throw new Error('operation dependency cycle detected')
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of operations.get(id).dependsOn.filter((item) => included.has(item)).sort()) visit(dependency)
    visiting.delete(id)
    visited.add(id)
    ordered.push(operations.get(id))
  }
  for (const id of [...included].sort()) visit(id)

  const variants = []
  const addVariant = (kind, operationId, expectedBehavior) => variants.push({
    id: kind + '-' + operationId,
    injection: { kind, operationId },
    expectedBehavior,
  })
  for (const operation of ordered) {
    if (['webhook', 'notify'].includes(operation.action)) {
      addVariant('duplicate-delivery', operation.id, 'deduplicate-by-idempotency-key-or-record-a-safe-no-op')
      addVariant('delivery-timeout', operation.id, 'retry-with-bounded-policy-without-duplicating-side-effects')
    }
    if (['charge', 'publish', 'write', 'delete'].includes(operation.action)) {
      addVariant('partial-failure', operation.id, 'preserve-transaction-boundary-or-run-explicit-compensation')
    }
    if (operation.dependsOn.length > 0) {
      addVariant('dependency-reordering', operation.id, 'reject-invalid-order-or-wait-for-dependency-completion')
    }
  }
  const assertions = [...new Set(ordered.flatMap((operation) => operation.invariants))].sort()
  const parsedNow = Date.parse(now)
  if (!Number.isFinite(parsedNow)) throw new Error('now must be a valid timestamp')
  const replay = {
    schemaVersion: 1,
    incidentId: incident.id,
    title: typeof incident.title === 'string' && incident.title.trim() ? incident.title.trim() : incident.id,
    operations: ordered,
    assertions,
    variants,
    minimization: {
      method: 'selected-operation-dependency-closure',
      selectedOperationIds: selected,
      includedOperationIds: ordered.map((operation) => operation.id),
      omittedOperationCount: operations.size - ordered.length,
      minimalityClaim: 'dependency-minimal relative to the supplied selection and dependency declarations; not a globally minimal reproducer',
    },
    generatedAt: new Date(parsedNow).toISOString(),
    advisoryOnly: true,
    note: 'Data-only replay specification. No operation is executed and no incident payload, credential, or raw log is copied.',
  }
  const digest = createHash('sha256').update(canonical(replay)).digest('hex')
  return { ...replay, digest }
}
