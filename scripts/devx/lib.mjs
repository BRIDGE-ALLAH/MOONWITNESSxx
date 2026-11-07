import { createHash } from 'node:crypto'
import { access, appendFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const WORKSPACE_ROOTS = ['apps', 'packages']
const SAFE_CONTEXT_FILES = ['AGENTS.md', '.copilot-instructions.md', 'README.md', 'CONTRIBUTING.md', 'docs/24-repository-and-automation-governance.md', 'pnpm-workspace.yaml', 'turbo.json']

async function readJson(path, root) {
  return JSON.parse(await readFile(join(root, path), 'utf8'))
}

async function exists(path, root) {
  try {
    await access(join(root, path))
    return true
  } catch {
    return false
  }
}

export async function loadWorkspacePackages(root) {
  const packages = []
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    let entries = []
    try {
      entries = await readdir(join(root, workspaceRoot), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const path = join(workspaceRoot, entry.name).replaceAll('\\', '/')
      try {
        const manifest = await readJson(path + '/package.json', root)
        if (manifest.name) packages.push({ name: manifest.name, path, manifest })
      } catch {
        // Non-package directories are not workspace packages.
      }
    }
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name))
}

export function parseMajorVersion(version) {
  const match = String(version).match(/^v?(\d+)(?:\.|$)/)
  return match ? Number(match[1]) : null
}

export async function runDoctor({ root, nodeVersion = process.version, pnpmVersion = null }) {
  const findings = []
  const rootManifest = await readJson('package.json', root)
  const workspacePackages = await loadWorkspacePackages(root)
  const workspaceText = await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8').catch(() => '')

  const nodeMajor = parseMajorVersion(nodeVersion)
  findings.push({
    id: 'node-version',
    status: nodeMajor !== null && nodeMajor >= 22 ? 'pass' : 'fail',
    message: nodeMajor !== null && nodeMajor >= 22 ? 'Node.js ' + nodeVersion + ' meets the Node 22+ baseline.' : 'Node.js ' + nodeVersion + ' is unsupported; use Node.js 22 or newer.',
    fix: 'Install the Node version declared by the repository toolchain policy.',
  })

  const expectedPnpm = String(rootManifest.packageManager ?? '').match(/^pnpm@(.+)$/)?.[1] ?? null
  if (!expectedPnpm) {
    findings.push({ id: 'package-manager-pin', status: 'fail', message: 'Root package.json does not pin pnpm.', fix: 'Set packageManager to the repository-approved pnpm version.' })
  } else if (pnpmVersion === null) {
    findings.push({ id: 'pnpm-installed', status: 'warn', message: 'pnpm@' + expectedPnpm + ' is required but the executable version could not be read.', fix: 'Enable Corepack or install the pinned pnpm version.' })
  } else {
    const actual = String(pnpmVersion).trim().replace(/^v/, '')
    findings.push({
      id: 'pnpm-version',
      status: actual === expectedPnpm ? 'pass' : 'fail',
      message: actual === expectedPnpm ? 'pnpm ' + actual + ' matches the pinned version.' : 'pnpm ' + actual + ' does not match pinned pnpm ' + expectedPnpm + '.',
      fix: 'Run corepack prepare pnpm@' + expectedPnpm + ' --activate.',
    })
  }

  for (const required of ['apps/*', 'packages/*']) {
    const present = workspaceText.includes(required)
    findings.push({
      id: 'workspace-' + required.replace(/[^a-z]+/gi, '-'),
      status: present ? 'pass' : 'fail',
      message: present ? 'Workspace includes ' + required + '.' : 'Workspace is missing ' + required + '.',
      fix: 'Restore the canonical workspace globs in pnpm-workspace.yaml.',
    })
  }

  const lockfileExists = await exists('pnpm-lock.yaml', root)
  findings.push({
    id: 'lockfile',
    status: lockfileExists ? 'pass' : 'fail',
    message: lockfileExists ? 'pnpm-lock.yaml exists.' : 'pnpm-lock.yaml is missing.',
    fix: 'Run pnpm run lockfile:refresh and review the resulting diff.',
  })
  const envTemplateExists = await exists('.env.example', root)
  findings.push({
    id: 'env-example',
    status: envTemplateExists ? 'pass' : 'warn',
    message: envTemplateExists ? 'Safe environment template exists.' : 'No .env.example was found.',
    fix: 'Document required non-secret environment variable names in .env.example.',
  })
  const dependenciesInstalled = await exists('node_modules', root)
  findings.push({
    id: 'dependencies-installed',
    status: dependenciesInstalled ? 'pass' : 'warn',
    message: dependenciesInstalled ? 'Root node_modules directory exists.' : 'Dependencies do not appear to be installed.',
    fix: 'Run pnpm install --frozen-lockfile after resolving any lockfile drift.',
  })

  for (const pkg of workspacePackages) {
    const hasScripts = Object.keys(pkg.manifest.scripts ?? {}).length > 0
    findings.push({
      id: 'package-' + pkg.name,
      status: hasScripts ? 'pass' : 'warn',
      message: hasScripts ? pkg.name + ' exposes package scripts.' : pkg.name + ' has no package scripts.',
      fix: 'Inspect ' + pkg.path + '/package.json and add only real, testable commands owned by this package.',
    })
  }

  const counts = Object.fromEntries(['pass', 'warn', 'fail'].map((status) => [status, findings.filter((item) => item.status === status).length]))
  return { ok: counts.fail === 0, counts, nodeVersion, pnpmVersion, expectedPnpm, packageCount: workspacePackages.length, findings }
}

function workspaceDependencies(manifest) {
  const names = []
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (String(version).startsWith('workspace:')) names.push(name)
    }
  }
  return names
}

export async function createChangePlan({ root, changedFiles }) {
  const packages = await loadWorkspacePackages(root)
  const direct = new Set()
  const reasons = new Map()
  const rootWide = changedFiles.some((file) => !WORKSPACE_ROOTS.some((prefix) => file.startsWith(prefix + '/')))

  if (rootWide) {
    for (const pkg of packages) {
      direct.add(pkg.name)
      reasons.set(pkg.name, ['root-level tooling/configuration changed'])
    }
  } else {
    for (const file of changedFiles) {
      const pkg = packages.find((candidate) => file === candidate.path || file.startsWith(candidate.path + '/'))
      if (pkg) {
        direct.add(pkg.name)
        const current = reasons.get(pkg.name) ?? []
        current.push(file)
        reasons.set(pkg.name, current)
      }
    }
  }

  const impacted = new Set(direct)
  let changed = true
  while (changed) {
    changed = false
    for (const pkg of packages) {
      if (impacted.has(pkg.name)) continue
      const affectedDependencies = workspaceDependencies(pkg.manifest).filter((name) => impacted.has(name))
      if (affectedDependencies.length) {
        impacted.add(pkg.name)
        reasons.set(pkg.name, affectedDependencies.map((name) => 'depends on changed package ' + name))
        changed = true
      }
    }
  }

  const tasks = []
  for (const pkg of packages.filter((item) => impacted.has(item.name))) {
    const scripts = pkg.manifest.scripts ?? {}
    const selected = ['test', 'test:governance', 'type-check', 'build'].filter((name) => scripts[name])
    for (const script of selected) {
      tasks.push({
        id: pkg.name + ':' + script,
        package: pkg.name,
        script,
        command: 'pnpm --filter ' + pkg.name + ' run ' + script,
        reason: reasons.get(pkg.name) ?? [],
      })
    }
  }

  return {
    changedFiles: [...new Set(changedFiles)].sort(),
    directPackages: [...direct].sort(),
    impactedPackages: [...impacted].sort(),
    tasks,
    notes: changedFiles.length ? [] : ['No changed files were detected. Pass --base <ref> or stage/modify files before planning.'],
  }
}

function redact(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/(?:api[_-]?key|access[_-]?token|secret|password|private[_-]?key)\s*[:=]/i.test(line))
    .join('\n')
}

export async function compileRepoContext({ root, maxChars = 12000, format = 'markdown' }) {
  const packages = await loadWorkspacePackages(root)
  const sections = []
  for (const path of SAFE_CONTEXT_FILES) {
    try {
      const content = redact(await readFile(join(root, path), 'utf8'))
      sections.push({ path, content })
    } catch {
      // Optional context files are omitted when absent.
    }
  }
  const packageSummary = packages.map(({ name, path, manifest }) => ({
    name,
    path,
    scripts: Object.keys(manifest.scripts ?? {}).sort(),
    workspaceDependencies: workspaceDependencies(manifest).sort(),
  }))
  const payload = { schemaVersion: 1, generatedBy: 'moonwitness-devx', packageCount: packages.length, packages: packageSummary, sections }
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const document = { ...payload, fingerprint }
  const rendered = format === 'json'
    ? JSON.stringify(document, null, 2)
    : [
        '# MOONWITNESS Repository Context',
        '',
        'Context fingerprint: ' + fingerprint,
        '',
        '## Workspace package map',
        ...packageSummary.map((pkg) => '- ' + pkg.name + ' — ' + pkg.path + '; scripts: ' + (pkg.scripts.join(', ') || 'none') + '; workspace deps: ' + (pkg.workspaceDependencies.join(', ') || 'none')),
        '',
        ...sections.flatMap((section) => ['## Source: ' + section.path, '', section.content, '']),
      ].join('\n')

  if (rendered.length <= maxChars) return { fingerprint, truncated: false, content: rendered }
  if (format === 'json') {
    const compact = { ...document, truncated: true, sections: [] }
    for (const section of sections) {
      compact.sections.push(section)
      if (JSON.stringify(compact, null, 2).length > maxChars) {
        compact.sections.pop()
        break
      }
    }
    let content = JSON.stringify(compact, null, 2)
    if (content.length > maxChars) {
      content = JSON.stringify({ schemaVersion: 1, fingerprint, truncated: true, packageCount: packages.length, packages: [] }, null, 2)
    }
    return { fingerprint, truncated: true, content }
  }
  const suffix = '\n\n[Context truncated at ' + maxChars + ' characters. Fingerprint covers the complete source context.]'
  return { fingerprint, truncated: true, content: rendered.slice(0, Math.max(0, maxChars - suffix.length)) + suffix }
}


// Phase 24: local execution receipts. Hash chaining detects accidental edits and
// reordering; it is not a digital signature or protection against a privileged
// attacker who can rewrite the entire file.
const recorderLocks = new Map()

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

function recordDigest(record) {
  return createHash('sha256').update(canonicalJson(record)).digest('hex')
}

function sanitizeFlightRecord(value) {
  if (Array.isArray(value)) return value.map(sanitizeFlightRecord)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /api[_-]?key|access[_-]?token|secret|password|private[_-]?key|authorization|cookie/i.test(key)
        ? '[REDACTED]'
        : sanitizeFlightRecord(item),
    ]))
  }
  return value
}

export async function appendFlightRecord({ root, record, file = '.moonwitness/flight-recorder.jsonl' }) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('record must be an object')
  const safeRecord = sanitizeFlightRecord(record)
  if (Buffer.byteLength(JSON.stringify(safeRecord), 'utf8') > 256 * 1024) throw new Error('record exceeds the 256 KiB limit')
  const path = join(root, file)
  const previousLock = recorderLocks.get(path) ?? Promise.resolve()
  let release
  const currentLock = new Promise((resolve) => { release = resolve })
  const queuedLock = previousLock.then(() => currentLock)
  recorderLocks.set(path, queuedLock)
  await previousLock
  try {
    const existing = await verifyFlightRecorder({ root, file })
    if (!existing.valid) throw new Error('flight recorder is corrupt: ' + existing.reason)
    const payload = {
      schemaVersion: 1,
      sequence: existing.records.length + 1,
      previousHash: existing.records.at(-1)?.hash ?? 'GENESIS',
      recordedAt: new Date().toISOString(),
      record: safeRecord,
    }
    const entry = { ...payload, hash: recordDigest(payload) }
    await mkdir(join(root, '.moonwitness'), { recursive: true })
    await appendFile(path, JSON.stringify(entry) + '\n', { encoding: 'utf8', flag: 'a' })
    return entry
  } finally {
    release()
    if (recorderLocks.get(path) === queuedLock) recorderLocks.delete(path)
  }
}

export async function verifyFlightRecorder({ root, file = '.moonwitness/flight-recorder.jsonl' }) {
  const path = join(root, file)
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { valid: true, records: [], headHash: 'GENESIS' }
    throw error
  }
  const lines = text.split(/\r?\n/).filter(Boolean)
  const records = []
  let previousHash = 'GENESIS'
  for (let index = 0; index < lines.length; index += 1) {
    let entry
    try { entry = JSON.parse(lines[index]) } catch { return { valid: false, records, reason: 'invalid_json_at_line_' + (index + 1), headHash: previousHash } }
    const { hash, ...payload } = entry
    if (entry.schemaVersion !== 1 || entry.sequence !== index + 1) return { valid: false, records, reason: 'sequence_mismatch_at_line_' + (index + 1), headHash: previousHash }
    if (entry.previousHash !== previousHash) return { valid: false, records, reason: 'previous_hash_mismatch_at_line_' + (index + 1), headHash: previousHash }
    if (hash !== recordDigest(payload)) return { valid: false, records, reason: 'hash_mismatch_at_line_' + (index + 1), headHash: previousHash }
    records.push(entry)
    previousHash = hash
  }
  return { valid: true, records, headHash: previousHash }
}

// Phase 25: predict overlapping write ownership before launching parallel agents.
function normalizeWritePath(path) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('write paths must be non-empty strings')
  const slashPath = path.replaceAll('\\', '/')
  if (slashPath.startsWith('/')) throw new Error('unsafe write path: ' + path)
  const segments = slashPath.split('/').filter((part) => part && part !== '.')
  if (segments.some((part) => part === '..') || segments.length === 0) throw new Error('unsafe write path: ' + path)
  return segments.join('/')
}

export function forecastWriteCollisions({ agents }) {
  if (!Array.isArray(agents)) throw new Error('agents must be an array')
  const owners = new Map()
  for (const agent of agents) {
    if (!agent?.id || !Array.isArray(agent.writePaths)) throw new Error('each agent needs an id and writePaths')
    for (const rawPath of agent.writePaths) {
      const path = normalizeWritePath(rawPath)
      const list = owners.get(path) ?? []
      if (!list.includes(agent.id)) list.push(agent.id)
      owners.set(path, list)
    }
  }
  const paths = [...owners.keys()].sort()
  const collisions = []
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      const a = paths[left]
      const b = paths[right]
      if (b.startsWith(a + '/')) {
        const participants = [...new Set([...owners.get(a), ...owners.get(b)])].sort()
        if (participants.length > 1) collisions.push({ kind: 'ancestor-overlap', paths: [a, b], agents: participants, severity: 'high' })
      }
    }
  }
  for (const [path, ids] of owners) {
    if (ids.length > 1) collisions.push({ kind: 'same-path', paths: [path], agents: [...ids].sort(), severity: 'critical' })
  }
  collisions.sort((a, b) => a.kind.localeCompare(b.kind) || a.paths.join('|').localeCompare(b.paths.join('|')))
  return {
    safeToParallelize: collisions.length === 0,
    agentCount: agents.length,
    uniqueWritePaths: owners.size,
    collisions,
    notes: ['Static path overlap only: runtime resources, generated files, shared databases, ports and semantic conflicts are not inferred.'],
  }
}

// Phase 26: make context validity explicit and machine-checkable.
export function createContextLease({ fingerprint, generatedAt = new Date().toISOString(), ttlMs = 60 * 60 * 1000 }) {
  if (!/^[a-f0-9]{64}$/.test(String(fingerprint))) throw new Error('fingerprint must be a SHA-256 hex digest')
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('ttlMs must be a positive safe integer')
  const issuedAt = Date.parse(generatedAt)
  if (!Number.isFinite(issuedAt)) throw new Error('generatedAt must be a valid timestamp')
  return {
    schemaVersion: 1,
    fingerprint,
    generatedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(issuedAt + ttlMs).toISOString(),
    ttlMs,
  }
}

export function verifyContextLease({ lease, currentFingerprint, now = new Date().toISOString() }) {
  if (!lease || lease.schemaVersion !== 1) return { valid: false, reason: 'unsupported_lease_schema' }
  if (lease.fingerprint !== currentFingerprint) return { valid: false, reason: 'context_fingerprint_changed' }
  const nowMs = Date.parse(now)
  const issuedMs = Date.parse(lease.generatedAt)
  const expiresMs = Date.parse(lease.expiresAt)
  if (!Number.isFinite(nowMs) || !Number.isFinite(issuedMs) || !Number.isFinite(expiresMs) || !Number.isSafeInteger(lease.ttlMs) || lease.ttlMs <= 0) {
    return { valid: false, reason: 'invalid_lease_time' }
  }
  if (expiresMs !== issuedMs + lease.ttlMs) return { valid: false, reason: 'lease_duration_mismatch' }
  if (nowMs < issuedMs) return { valid: false, reason: 'lease_not_yet_valid' }
  if (nowMs >= expiresMs) return { valid: false, reason: 'context_lease_expired' }
  return { valid: true, expiresAt: lease.expiresAt, fingerprint: lease.fingerprint }
}


function normalizedSet(values, field) {
  if (!Array.isArray(values)) throw new Error(field + ' must be an array')
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort()
}

export function fingerprintObjectiveGap({ failedTests = [], missingCriteria = [], blockers = [] } = {}) {
  const gap = { failedTests: normalizedSet(failedTests, 'failedTests'), missingCriteria: normalizedSet(missingCriteria, 'missingCriteria'), blockers: normalizedSet(blockers, 'blockers') }
  return { fingerprint: createHash('sha256').update(canonicalJson(gap)).digest('hex'), gap }
}

export function analyzeObjectiveProgress({ steps, repeatThreshold = 3 } = {}) {
  if (!Array.isArray(steps) || !steps.length) throw new Error('steps must be a non-empty array')
  if (!Number.isSafeInteger(repeatThreshold) || repeatThreshold < 2) throw new Error('repeatThreshold must be an integer >= 2')
  const observations = steps.map((step, index) => {
    if (!step || typeof step !== 'object') throw new Error('each step must be an object')
    const { fingerprint, gap } = fingerprintObjectiveGap(step)
    return { index, fingerprint, gap, activity: String(step.activity ?? '').slice(0, 160) }
  })
  let streak = 1
  for (let i = observations.length - 1; i > 0 && observations[i].fingerprint === observations[i - 1].fingerprint; i -= 1) streak += 1
  const changed = observations.length > 1 && observations.at(-1).fingerprint !== observations.at(-2).fingerprint
  return {
    stalled: streak >= repeatThreshold, consecutiveUnchangedGap: streak, repeatThreshold,
    latestFingerprint: observations.at(-1).fingerprint, latestGap: observations.at(-1).gap,
    objectiveImproved: changed, stepCount: observations.length,
    recommendation: streak >= repeatThreshold ? 'pause_and_replan: the same unresolved objective gap persisted across consecutive observations'
      : changed ? 'continue_with_verification: objective gap changed; verify whether it materially improved'
        : 'continue_observing: insufficient repeated evidence to classify a loop',
    observations,
  }
}

export function validateInterfaceTreaty({ treaty, now = new Date().toISOString() } = {}) {
  if (!treaty || typeof treaty !== 'object' || Array.isArray(treaty)) return { valid: false, violations: ['treaty_must_be_an_object'] }
  const violations = [], owner = typeof treaty.owner === 'string' ? treaty.owner.trim() : '', id = typeof treaty.id === 'string' ? treaty.id.trim() : ''
  if (!owner) violations.push('missing_owner')
  if (!id) violations.push('missing_id')
  for (const field of ['provides', 'consumes', 'breakingChanges']) if (treaty[field] !== undefined && !Array.isArray(treaty[field])) violations.push(field + '_must_be_an_array')
  const values = (field) => Array.isArray(treaty[field]) ? treaty[field].map(v => String(v).trim()).filter(Boolean) : []
  const provides=values('provides'), consumes=values('consumes'), breakingChanges=values('breakingChanges')
  if (!provides.length && !consumes.length && !breakingChanges.length) violations.push('treaty_has_no_interface_declarations')
  const expiry=Date.parse(treaty.expiresAt), nowMs=Date.parse(now)
  if (!Number.isFinite(expiry) || !Number.isFinite(nowMs)) violations.push('invalid_expiry')
  else if (expiry <= nowMs) violations.push('treaty_expired')
  if (new Set(provides.map(v=>v.toLowerCase())).size !== provides.length) violations.push('duplicate_provided_interface')
  if (new Set(consumes.map(v=>v.toLowerCase())).size !== consumes.length) violations.push('duplicate_consumed_interface')
  return { valid: violations.length===0, violations, normalized:{id,owner,provides,consumes,breakingChanges,expiresAt:Number.isFinite(expiry)?new Date(expiry).toISOString():null} }
}

export function forecastInterfaceConflicts({ treaties, now = new Date().toISOString() } = {}) {
  if (!Array.isArray(treaties)) throw new Error('treaties must be an array')
  const checked=treaties.map(treaty=>({treaty,result:validateInterfaceTreaty({treaty,now})}))
  const violations=checked.flatMap(({treaty,result})=>result.violations.map(code=>({code,treatyId:treaty?.id??null,owner:treaty?.owner??null})))
  const valid=checked.filter(x=>x.result.valid).map(x=>x.result.normalized), conflicts=[], providers=new Map()
  for (const t of valid) for (const name of t.provides) { const key=name.toLowerCase(), owners=providers.get(key)??[]; owners.push(t.owner); providers.set(key,owners) }
  for (const [name,owners] of providers) if(new Set(owners).size>1) conflicts.push({kind:'duplicate-provider',interface:name,owners:[...new Set(owners)].sort(),severity:'critical'})
  for (const producer of valid) for (const breaking of producer.breakingChanges) for (const consumer of valid) {
    if (consumer.owner!==producer.owner && consumer.consumes.some(name=>name.toLowerCase()===breaking.toLowerCase()))
      conflicts.push({kind:'breaking-change-consumed',interface:breaking.toLowerCase(),producer:producer.owner,consumer:consumer.owner,severity:'high'})
  }
  return {safeToIntegrate:violations.length===0&&conflicts.length===0,treatyCount:treaties.length,violations,conflicts}
}

const RESOURCE_KINDS=['ports','databases','queues','volumes','envNamespaces']
export function createResourcePassport({agentId,resources={}}={}) {
  if(typeof agentId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(agentId)) throw new Error('agentId must be a safe 1-64 character identifier')
  if(!resources||typeof resources!=='object'||Array.isArray(resources)) throw new Error('resources must be an object')
  const normalized={}
  for(const kind of RESOURCE_KINDS) {
    const values=resources[kind]??[]
    if(!Array.isArray(values)) throw new Error(kind+' must be an array')
    if(kind==='ports') {
      normalized.ports=[...new Set(values.map(Number))]
      if(normalized.ports.some(p=>!Number.isInteger(p)||p<1||p>65535)) throw new Error('ports must be integers between 1 and 65535')
    } else {
      normalized[kind]=[...new Set(values.map(v=>{
        if(typeof v!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(v)) throw new Error(kind+' entries must be safe identifiers')
        return v
      }))]
    }
  }
  const namespace='mw-'+agentId.toLowerCase().replace(/[^a-z0-9-]/g,'-')
  return {schemaVersion:1,agentId,namespace,resources:normalized,namespaced:{
    databases:normalized.databases.map(v=>namespace+'-'+v),queues:normalized.queues.map(v=>namespace+'-'+v),
    volumes:normalized.volumes.map(v=>namespace+'-'+v),envNamespaces:normalized.envNamespaces.map(v=>namespace+'-'+v),
  },note:'Port values remain host-level reservations; namespaced labels require runtime-adapter enforcement.'}
}

export function forecastResourceCollisions({agents}={}) {
  if(!Array.isArray(agents)) throw new Error('agents must be an array')
  const owners=new Map(), add=(kind,value,id)=>{const key=kind+':'+String(value).toLowerCase(),ids=owners.get(key)??[];if(!ids.includes(id))ids.push(id);owners.set(key,ids)}
  for(const agent of agents) {
    if(!agent||typeof agent.id!=='string'||!agent.id.trim()) throw new Error('each agent needs an id')
    const p=createResourcePassport({agentId:agent.id,resources:agent.resources??{}})
    for(const port of p.resources.ports) add('port',port,agent.id)
    for(const kind of ['databases','queues','volumes','envNamespaces']) for(const value of p.resources[kind]) add(kind,value,agent.id)
  }
  const collisions=[...owners.entries()].filter(([,ids])=>ids.length>1).map(([resource,ids])=>({resource,agents:ids.sort(),severity:resource.startsWith('port:')?'critical':'high'})).sort((a,b)=>a.resource.localeCompare(b.resource))
  return {safeToLaunchTogether:collisions.length===0,agentCount:agents.length,declaredResourceCount:owners.size,collisions,note:'Advisory only: does not reserve ports, provision databases, isolate containers, or enforce namespaces.'}
}


// Phase 30: objective control plane. A criterion is complete only with verified evidence.
export function buildObjectiveControlPlane({ objectives, observations = [], now = new Date().toISOString() } = {}) {
  if (!Array.isArray(objectives) || objectives.length === 0) throw new Error('objectives must be a non-empty array')
  if (!Array.isArray(observations)) throw new Error('observations must be an array')
  const nowMs = Date.parse(now)
  if (!Number.isFinite(nowMs)) throw new Error('now must be a valid timestamp')
  const seen = new Set()
  const normalized = objectives.map((objective) => {
    if (!objective || typeof objective.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(objective.id)) throw new Error('each objective needs a safe id')
    if (seen.has(objective.id)) throw new Error('duplicate objective id: ' + objective.id)
    seen.add(objective.id)
    if (!Array.isArray(objective.acceptanceCriteria) || objective.acceptanceCriteria.length === 0) throw new Error('objective ' + objective.id + ' needs acceptanceCriteria')
    const criterionIds = new Set()
    const criteria = objective.acceptanceCriteria.map((criterion) => {
      if (!criterion || typeof criterion.id !== 'string' || !criterion.id.trim()) throw new Error('acceptance criteria need ids')
      if (criterionIds.has(criterion.id)) throw new Error('duplicate criterion id: ' + criterion.id)
      criterionIds.add(criterion.id)
      const history = observations.filter((item) => item?.objectiveId === objective.id && item?.criterionId === criterion.id)
        .map((item) => {
          const timestamp = Date.parse(item.recordedAt)
          if (!Number.isFinite(timestamp) || timestamp > nowMs) throw new Error('invalid or future observation timestamp')
          if (!['passed', 'failed', 'unknown'].includes(item.status)) throw new Error('observation status must be passed, failed or unknown')
          return { ...item, timestamp }
        }).sort((a, b) => b.timestamp - a.timestamp)
      const latest = history[0] ?? null
      const verified = Boolean(latest && latest.status === 'passed' && latest.verified === true &&
        typeof latest.evidenceId === 'string' && latest.evidenceId.trim())
      return {
        id: criterion.id,
        description: String(criterion.description ?? criterion.id),
        owner: String(criterion.owner ?? objective.owner ?? 'unassigned'),
        status: verified ? 'satisfied' : 'open',
        latestObservation: latest ? { status: latest.status, verified: latest.verified === true, evidenceId: latest.evidenceId ?? null, recordedAt: latest.recordedAt } : null,
        reason: verified ? null : !latest ? 'no_observation' : latest.status === 'passed' ? 'missing_verified_evidence' : 'criterion_not_passed',
      }
    })
    const blockers = normalizedSet(objective.blockers ?? [], 'objective.blockers')
    const openCriteria = criteria.filter((criterion) => criterion.status !== 'satisfied')
    const gap = { openCriteria: openCriteria.map((criterion) => criterion.id).sort(), blockers }
    return {
      id: objective.id, title: String(objective.title ?? objective.id), owner: String(objective.owner ?? 'unassigned'),
      priority: Number.isFinite(objective.priority) ? objective.priority : 0,
      status: openCriteria.length === 0 && blockers.length === 0 ? 'complete' : 'active',
      criteria, openCriteria, blockers,
      gapFingerprint: createHash('sha256').update(canonicalJson(gap)).digest('hex'),
      nextActions: openCriteria.map((criterion) => ({ criterionId: criterion.id, owner: criterion.owner, action: 'obtain_verified_evidence' })),
    }
  }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  const completed = normalized.filter((objective) => objective.status === 'complete').length
  return {
    schemaVersion: 1, generatedAt: new Date(nowMs).toISOString(),
    objectiveCount: normalized.length, completedCount: completed, openCount: normalized.length - completed,
    ready: completed === normalized.length,
    objectives: normalized,
    nextActions: normalized.flatMap((objective) => objective.nextActions.map((action) => ({ objectiveId: objective.id, ...action }))),
    note: 'A criterion is complete only when its latest observation is passed, explicitly verified, timestamp-valid and linked to an evidenceId. This report does not authenticate the evidence source.',
  }
}

// Phase 31: breaking interface changes are escrowed until every declared consumer acknowledges the exact contract fingerprint.
function interfaceEscrowFingerprint(contract, treaties) {
  return createHash('sha256').update(canonicalJson({
    contract,
    treaties: treaties.map((treaty) => ({
      id: treaty.id, owner: treaty.owner,
      provides: [...(treaty.provides ?? [])].map(String).sort(),
      consumes: [...(treaty.consumes ?? [])].map(String).sort(),
      breakingChanges: [...(treaty.breakingChanges ?? [])].map(String).sort(),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  })).digest('hex')
}

export function createInterfaceEscrow({ treaties, changeSet, now = new Date().toISOString() } = {}) {
  if (!Array.isArray(treaties)) throw new Error('treaties must be an array')
  if (!changeSet || typeof changeSet.id !== 'string' || !changeSet.id.trim()) throw new Error('changeSet needs an id')
  if (!Array.isArray(changeSet.breakingInterfaces) || changeSet.breakingInterfaces.length === 0) throw new Error('changeSet needs breakingInterfaces')
  const expiry = Date.parse(changeSet.expiresAt), nowMs = Date.parse(now)
  if (!Number.isFinite(expiry) || !Number.isFinite(nowMs) || expiry <= nowMs) throw new Error('changeSet expiry must be in the future')
  const report = forecastInterfaceConflicts({ treaties, now })
  if (report.violations.length) throw new Error('invalid interface treaties: ' + report.violations.map((item) => item.code).join(','))
  const interfaces = normalizedSet(changeSet.breakingInterfaces, 'breakingInterfaces').map((name) => name.toLowerCase())
  const consumers = [...new Set(treaties.filter((treaty) =>
    (treaty.consumes ?? []).some((name) => interfaces.includes(String(name).toLowerCase()))
  ).map((treaty) => treaty.owner))].sort()
  const contract = { id: changeSet.id, version: String(changeSet.version ?? 'unspecified'), breakingInterfaces: interfaces, expiresAt: new Date(expiry).toISOString() }
  const treatySnapshot = treaties.map((treaty) => ({
    id: treaty.id, owner: treaty.owner,
    provides: [...(treaty.provides ?? [])].map(String).sort(),
    consumes: [...(treaty.consumes ?? [])].map(String).sort(),
    breakingChanges: [...(treaty.breakingChanges ?? [])].map(String).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id))
  const contractFingerprint = interfaceEscrowFingerprint(contract, treatySnapshot)
  return {
    schemaVersion: 1, state: consumers.length ? 'awaiting-consumer-acknowledgements' : 'ready',
    contract, treatySnapshot, contractFingerprint, consumers, acknowledgements: [],
    createdAt: new Date(nowMs).toISOString(),
    note: 'Acknowledgements bind to this exact declared contract snapshot; no runtime API/schema compatibility is inferred.',
  }
}

export function acknowledgeInterfaceEscrow({ escrow, consumer, contractFingerprint, acknowledgedAt = new Date().toISOString() } = {}) {
  if (!escrow || escrow.schemaVersion !== 1) throw new Error('unsupported interface escrow')
  if (contractFingerprint !== escrow.contractFingerprint) throw new Error('acknowledgement fingerprint does not match escrow contract')
  if (!escrow.consumers.includes(consumer)) throw new Error('consumer is not in the escrow impact set')
  const timestamp = Date.parse(acknowledgedAt), expiry = Date.parse(escrow.contract.expiresAt)
  if (!Number.isFinite(timestamp) || timestamp >= expiry || timestamp < Date.parse(escrow.createdAt)) throw new Error('acknowledgement timestamp is outside escrow validity')
  if (escrow.acknowledgements.some((item) => item.consumer === consumer)) throw new Error('consumer already acknowledged this escrow')
  const acknowledgements = [...escrow.acknowledgements, { consumer, contractFingerprint, acknowledgedAt: new Date(timestamp).toISOString() }].sort((a, b) => a.consumer.localeCompare(b.consumer))
  return { ...escrow, acknowledgements, state: acknowledgements.length === escrow.consumers.length ? 'acknowledged' : 'awaiting-consumer-acknowledgements' }
}

export function verifyInterfaceEscrow({ escrow, now = new Date().toISOString() } = {}) {
  if (!escrow || escrow.schemaVersion !== 1 || !escrow.contract || !Array.isArray(escrow.consumers) || !Array.isArray(escrow.acknowledgements)) return { safeToMerge: false, reason: 'malformed_escrow' }
  const nowMs = Date.parse(now), expiry = Date.parse(escrow.contract.expiresAt)
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiry) || nowMs >= expiry) return { safeToMerge: false, reason: 'escrow_expired' }
  if (!Array.isArray(escrow.treatySnapshot) || interfaceEscrowFingerprint(escrow.contract, escrow.treatySnapshot) !== escrow.contractFingerprint) return { safeToMerge: false, reason: 'escrow_fingerprint_mismatch' }
  const expectedConsumers = [...new Set(escrow.treatySnapshot.filter((treaty) =>
    (treaty.consumes ?? []).some((name) => escrow.contract.breakingInterfaces.includes(String(name).toLowerCase()))
  ).map((treaty) => treaty.owner))].sort()
  if (canonicalJson(expectedConsumers) !== canonicalJson([...escrow.consumers].sort())) return { safeToMerge: false, reason: 'escrow_consumer_set_mismatch' }
  const valid = escrow.acknowledgements.filter((item) => escrow.consumers.includes(item.consumer) &&
    item.contractFingerprint === escrow.contractFingerprint && Number.isFinite(Date.parse(item.acknowledgedAt)) &&
    Date.parse(item.acknowledgedAt) >= Date.parse(escrow.createdAt) && Date.parse(item.acknowledgedAt) < expiry)
  const acknowledged = [...new Set(valid.map((item) => item.consumer))].sort()
  const duplicateAcknowledgements = valid.length !== acknowledged.length
  const missingConsumers = escrow.consumers.filter((consumer) => !acknowledged.includes(consumer)).sort()
  return { safeToMerge: missingConsumers.length === 0 && !duplicateAcknowledgements, duplicateAcknowledgements, contractFingerprint: escrow.contractFingerprint, consumers: escrow.consumers, acknowledgedConsumers: acknowledged, missingConsumers, reason: missingConsumers.length ? 'consumer_acknowledgement_missing' : null }
}

// Phase 32: assemble a fail-closed merge evidence packet. Supplied check statuses are assertions, not live GitHub attestations.
export function createMergeEvidencePacket({ commitSha, objectives, observations = [], interfaceEscrow, agents, checks, evidence, rollback, now = new Date().toISOString() } = {}) {
  const failures = []
  if (typeof commitSha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(commitSha)) failures.push('invalid_commit_sha')
  let objectiveReport
  try { objectiveReport = buildObjectiveControlPlane({ objectives, observations, now }) }
  catch (error) { failures.push('objective_report_invalid:' + error.message) }
  if (objectiveReport && !objectiveReport.ready) failures.push('objectives_not_complete')
  const escrowReport = verifyInterfaceEscrow({ escrow: interfaceEscrow, now })
  if (!escrowReport.safeToMerge) failures.push('interface_escrow_not_satisfied:' + escrowReport.reason)
  let resourceReport
  try { resourceReport = forecastResourceCollisions({ agents }) }
  catch (error) { failures.push('resource_manifest_invalid:' + error.message) }
  if (resourceReport && !resourceReport.safeToLaunchTogether) failures.push('resource_collisions_detected')
  const requiredChecks = ['repository-integrity', 'asset-integrity', 'developer-experience', 'full-workspace-quality']
  if (!Array.isArray(checks)) failures.push('checks_must_be_an_array')
  const normalizedChecks = Array.isArray(checks) ? checks : []
  for (const required of requiredChecks) if (!normalizedChecks.some((check) => check?.name === required && check.status === 'success')) failures.push('required_check_missing_or_failed:' + required)
  if (!Array.isArray(evidence) || evidence.length === 0) failures.push('evidence_required')
  else for (const item of evidence) if (!item || typeof item.id !== 'string' || !item.id.trim() || !/^[a-f0-9]{64}$/i.test(String(item.sha256 ?? ''))) failures.push('invalid_evidence_reference')
  if (!rollback || typeof rollback.strategy !== 'string' || !rollback.strategy.trim() || typeof rollback.owner !== 'string' || !rollback.owner.trim() || rollback.verified !== true) failures.push('verified_rollback_plan_required')
  const generatedMs = Date.parse(now)
  if (!Number.isFinite(generatedMs)) failures.push('invalid_now_timestamp')
  const payload = {
    schemaVersion: 1, commitSha, generatedAt: Number.isFinite(generatedMs) ? new Date(generatedMs).toISOString() : null,
    ready: failures.length === 0, failures,
    objectiveSummary: objectiveReport ? { ready: objectiveReport.ready, completed: objectiveReport.completedCount, total: objectiveReport.objectiveCount } : null,
    interfaceSummary: escrowReport,
    resourceSummary: resourceReport ? { safe: resourceReport.safeToLaunchTogether, collisions: resourceReport.collisions.length } : null,
    checks: normalizedChecks, evidence: Array.isArray(evidence) ? evidence : [], rollback: rollback ?? null,
    requiredChecks,
    note: 'Local evidence packet only. It does not query GitHub branch protection, authenticate supplied CI statuses, sign provider receipts, or merge a pull request.',
  }
  const digest = createHash('sha256').update(canonicalJson(payload)).digest('hex')
  return { ...payload, digest }
}
