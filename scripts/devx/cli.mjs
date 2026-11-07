#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  acknowledgeInterfaceEscrow,
  analyzeObjectiveProgress,
  buildObjectiveControlPlane,
  appendFlightRecord,
  compileRepoContext,
  createChangePlan,
  createContextLease,
  createInterfaceEscrow,
  createMergeEvidencePacket,
  forecastInterfaceConflicts,
  forecastResourceCollisions,
  forecastWriteCollisions,
  runDoctor,
  verifyContextLease,
  verifyInterfaceEscrow,
  verifyFlightRecorder,
} from './lib.mjs'
import { assessAutonomyBudget, compileIncidentRegression, planAdaptiveSwarm } from './frontier.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [command = 'help', ...args] = process.argv.slice(2)
const option = (name, fallback) => args.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback
const has = (name) => args.includes('--' + name)

function run(commandName, parameters) {
  return spawnSync(commandName, parameters, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' })
}

async function doctor() {
  const version = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version'])
  const report = await runDoctor({ root, pnpmVersion: version.status === 0 ? version.stdout.trim() : null })
  if (has('json')) console.log(JSON.stringify(report, null, 2))
  else console.log([
    'MOONWITNESS Developer Environment Doctor',
    'Node: ' + report.nodeVersion + ' | pnpm: ' + (report.pnpmVersion ?? 'not found') + ' | packages: ' + report.packageCount,
    '',
    ...report.findings.map((item) => item.status.toUpperCase().padEnd(5) + ' ' + item.id + ': ' + item.message + (item.status === 'fail' || item.status === 'warn' ? '\n      Fix: ' + item.fix : '')),
    '',
    'Summary: ' + report.counts.pass + ' pass, ' + report.counts.warn + ' warn, ' + report.counts.fail + ' fail',
  ].join('\n'))
  if (!report.ok) process.exitCode = 1
}

async function plan() {
  const base = option('base', 'main')
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMR', base + '...HEAD'],
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard'],
  ]
  const changedFiles = []
  for (const parameters of commands) {
    const result = run('git', parameters)
    if (result.status === 0) changedFiles.push(...result.stdout.split(/\r?\n/).filter(Boolean))
    else if (parameters[0] === 'diff' && parameters[3]?.includes('...')) {
      console.error("Unable to compare against '" + base + "'. Check that the ref exists or pass --base=<ref>.")
      process.exitCode = 2
      return
    }
  }
  const result = await createChangePlan({ root, changedFiles })
  if (has('json')) console.log(JSON.stringify(result, null, 2))
  else console.log([
    'Change-aware plan (base: ' + base + ')',
    'Changed files: ' + result.changedFiles.length,
    'Direct packages: ' + (result.directPackages.join(', ') || 'none'),
    'Impacted packages: ' + (result.impactedPackages.join(', ') || 'none'),
    '',
    ...result.tasks.map((task) => '- ' + task.command + '\n  because: ' + task.reason.join('; ')),
    ...result.notes,
    '',
    'Review this plan before running commands. It is advisory and does not execute tasks.',
  ].join('\n'))
}

async function context() {
  const maxChars = Math.max(1000, Number(option('max-chars', '12000')) || 12000)
  const result = await compileRepoContext({ root, maxChars, format: has('json') ? 'json' : 'markdown' })
  console.log(result.content)
  if (result.truncated) console.error('Context truncated; fingerprint ' + result.fingerprint)
}

async function collision() {
  const path = option('plan-file', null)
  if (!path) throw new Error('collision requires --plan-file=<json-file>')
  const input = JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const report = forecastWriteCollisions({ agents: input.agents })
  console.log(JSON.stringify(report, null, 2))
  if (!report.safeToParallelize) process.exitCode = 1
}

async function flight() {
  const subcommand = args[0] ?? 'verify'
  if (subcommand !== 'verify') throw new Error('flight supports: verify')
  const report = await verifyFlightRecorder({ root })
  console.log(JSON.stringify({ valid: report.valid, count: report.records.length, headHash: report.headHash, reason: report.reason ?? null }, null, 2))
  if (!report.valid) process.exitCode = 1
}

async function record() {
  const path = option('input', null)
  if (!path) throw new Error('record requires --input=<json-file>')
  const recordInput = JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const entry = await appendFlightRecord({ root, record: recordInput })
  console.log(JSON.stringify({ sequence: entry.sequence, hash: entry.hash, recordedAt: entry.recordedAt }, null, 2))
}

async function contextLease() {
  const output = option('out', '.moonwitness/context-lease.json')
  const ttlMs = Math.max(1000, Number(option('ttl-ms', '3600000')) || 3600000)
  const contextResult = await compileRepoContext({ root, maxChars: Number.MAX_SAFE_INTEGER, format: 'json' })
  const parsed = JSON.parse(contextResult.content)
  const lease = createContextLease({ fingerprint: parsed.fingerprint, ttlMs })
  const outputPath = resolve(root, output)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(lease, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
  console.log(JSON.stringify(lease, null, 2))
}

async function contextVerify() {
  const path = option('lease', null)
  if (!path) throw new Error('context-verify requires --lease=<lease-file>')
  const lease = JSON.parse(await readFile(resolve(root, path), 'utf8'))
  const contextResult = await compileRepoContext({ root, maxChars: Number.MAX_SAFE_INTEGER, format: 'json' })
  const parsed = JSON.parse(contextResult.content)
  const result = verifyContextLease({ lease, currentFingerprint: parsed.fingerprint })
  console.log(JSON.stringify(result, null, 2))
  if (!result.valid) process.exitCode = 1
}


async function objectiveWatch() {
 const p=option('input',null);if(!p)throw new Error('objective-watch requires --input=<observations.json>')
 const input=JSON.parse(await readFile(resolve(root,p),'utf8'))
 const report=analyzeObjectiveProgress({steps:input.steps,repeatThreshold:Number(option('repeat','3'))})
 console.log(JSON.stringify(report,null,2));if(report.stalled)process.exitCode=1
}
async function interfaceCheck() {
 const p=option('plan-file',null);if(!p)throw new Error('interface-check requires --plan-file=<treaties.json>')
 const input=JSON.parse(await readFile(resolve(root,p),'utf8')),report=forecastInterfaceConflicts({treaties:input.treaties})
 console.log(JSON.stringify(report,null,2));if(!report.safeToIntegrate)process.exitCode=1
}
async function resourceCheck() {
 const p=option('plan-file',null);if(!p)throw new Error('resource-check requires --plan-file=<resources.json>')
 const input=JSON.parse(await readFile(resolve(root,p),'utf8')),report=forecastResourceCollisions({agents:input.agents})
 console.log(JSON.stringify(report,null,2));if(!report.safeToLaunchTogether)process.exitCode=1
}

async function objectivePlane() {
  const p=option('input',null);if(!p)throw new Error('objective-plane requires --input=<objectives.json>')
  const input=JSON.parse(await readFile(resolve(root,p),'utf8'))
  const report=buildObjectiveControlPlane({objectives:input.objectives,observations:input.observations??[]})
  console.log(JSON.stringify(report,null,2));if(!report.ready)process.exitCode=1
}
async function interfaceEscrow() {
  const p=option('input',null);if(!p)throw new Error('interface-escrow requires --input=<escrow.json>')
  const input=JSON.parse(await readFile(resolve(root,p),'utf8'))
  const precomputed=input.schemaVersion===1
  let escrow=precomputed ? input : createInterfaceEscrow({treaties:input.treaties,changeSet:input.changeSet})
  if(!precomputed) for(const ack of input.acknowledgements??[]) escrow=acknowledgeInterfaceEscrow({escrow,...ack})
  const report=verifyInterfaceEscrow({escrow})
  console.log(JSON.stringify({escrow,verification:report},null,2));if(!report.safeToMerge)process.exitCode=1
}
async function mergeProof() {
  const p=option('input',null);if(!p)throw new Error('merge-proof requires --input=<merge-evidence.json>')
  const input=JSON.parse(await readFile(resolve(root,p),'utf8'))
  const packet=createMergeEvidencePacket(input)
  console.log(JSON.stringify(packet,null,2));if(!packet.ready)process.exitCode=1
}
async function swarmPlan() {
  const p = option('input', null)
  if (!p) throw new Error('swarm-plan requires --input=<swarm.json>')
  const input = JSON.parse(await readFile(resolve(root, p), 'utf8'))
  const report = planAdaptiveSwarm({ agents: input.agents, maxParallel: input.maxParallel ?? 2 })
  console.log(JSON.stringify(report, null, 2))
}
async function autonomyBudget() {
  const p = option('input', null)
  if (!p) throw new Error('autonomy-budget requires --input=<autonomy.json>')
  const input = JSON.parse(await readFile(resolve(root, p), 'utf8'))
  const report = assessAutonomyBudget(input)
  console.log(JSON.stringify(report, null, 2))
}
async function incidentCompile() {
  const p = option('input', null)
  if (!p) throw new Error('incident-compile requires --input=<incident.json>')
  const input = JSON.parse(await readFile(resolve(root, p), 'utf8'))
  const report = compileIncidentRegression({ incident: input.incident, now: input.now })
  console.log(JSON.stringify(report, null, 2))
}
function help() {
  console.log([
    'MOONWITNESS DX',
    '',
    'Commands:',
    '  pnpm devx doctor [--json]',
    '  pnpm devx plan [--base=main] [--json]',
    '  pnpm devx context [--json] [--max-chars=12000]',
    '  pnpm devx collision --plan-file=.moonwitness/agents.json',
    '  pnpm devx record --input=.moonwitness/task-result.json',
    '  pnpm devx flight verify',
    '  pnpm devx context-lease [--out=.moonwitness/context-lease.json] [--ttl-ms=3600000]',
    '  pnpm devx context-verify --lease=.moonwitness/context-lease.json',
    '  pnpm devx objective-watch --input=.moonwitness/objective.json [--repeat=3]',
    '  pnpm devx interface-check --plan-file=.moonwitness/treaties.json',
    '  pnpm devx resource-check --plan-file=.moonwitness/resources.json',
    '  pnpm devx objective-plane --input=.moonwitness/objectives.json',
    '  pnpm devx interface-escrow --input=.moonwitness/escrow.json',
    '  pnpm devx merge-proof --input=.moonwitness/merge-evidence.json',
    '  pnpm devx swarm-plan --input=.moonwitness/swarm.json',
    '  pnpm devx autonomy-budget --input=.moonwitness/autonomy.json',
    '  pnpm devx incident-compile --input=.moonwitness/incident.json',
    '',
    'Collision plans use { "agents": [{ "id": "agent-a", "writePaths": ["packages/foo"] }] }.',
    'Flight records are local evidence, not signed or tamper-proof attestations.',
    'Context lease creation is explicit and refuses to overwrite an existing lease.',
  ].join('\n'))
}

try {
  if (command === 'doctor') await doctor()
  else if (command === 'plan') await plan()
  else if (command === 'context') await context()
  else if (command === 'collision') await collision()
  else if (command === 'record') await record()
  else if (command === 'flight') await flight()
  else if (command === 'context-lease') await contextLease()
  else if (command === 'context-verify') await contextVerify()
  else if (command === 'objective-watch') await objectiveWatch()
  else if (command === 'interface-check') await interfaceCheck()
  else if (command === 'resource-check') await resourceCheck()
  else if (command === 'objective-plane') await objectivePlane()
  else if (command === 'interface-escrow') await interfaceEscrow()
  else if (command === 'merge-proof') await mergeProof()
  else if (command === 'swarm-plan') await swarmPlan()
  else if (command === 'autonomy-budget') await autonomyBudget()
  else if (command === 'incident-compile') await incidentCompile()
  else help()
} catch (error) {
  console.error(error.message)
  process.exitCode = 2
}
