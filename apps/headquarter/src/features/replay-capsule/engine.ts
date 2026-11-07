import { runScenario } from '../scenario-forge/engine'
import type { ScenarioDefinition, ScenarioMetric, ScenarioResult } from '../scenario-forge/types'
import type { ReplayCapsule, ReplayCapsulePayload, ReplayVerification } from './types'

export const REPLAY_ENGINE_VERSION = '1.0.0'

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']'
  const record = value as Record<string, unknown>
  return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalize(record[key])).join(',') + '}'
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable in this runtime')
  const bytes = new TextEncoder().encode(value)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function buildPayload(baseline: readonly ScenarioMetric[], scenario: ScenarioDefinition, result: ScenarioResult): ReplayCapsulePayload {
  return {
    schemaVersion: 1,
    engineVersion: REPLAY_ENGINE_VERSION,
    baseline: baseline.map((metric) => ({ ...metric })),
    scenario: {
      ...scenario,
      assumptions: [...scenario.assumptions],
      operations: scenario.operations.map((operation) => ({ ...operation })),
    },
    result: {
      ...result,
      assumptions: [...result.assumptions],
      metrics: result.metrics.map((metric) => ({ ...metric })),
    },
  }
}

/** Creates a content-addressed replay record. Hashing proves integrity, not signer identity or timestamp authenticity. */
export async function createReplayCapsule(
  baseline: readonly ScenarioMetric[],
  scenario: ScenarioDefinition,
  result: ScenarioResult = runScenario(baseline, scenario),
): Promise<ReplayCapsule> {
  const expected = runScenario(baseline, scenario)
  if (canonicalize(expected) !== canonicalize(result)) {
    throw new Error('Replay result does not match the supplied baseline and scenario')
  }
  const payload = buildPayload(baseline, scenario, result)
  const digest = await sha256(canonicalize(payload))
  return { algorithm: 'SHA-256', digest, payload }
}

/** Verifies both the capsule digest and deterministic recomputation from its embedded inputs. */
export async function verifyReplayCapsule(capsule: ReplayCapsule): Promise<ReplayVerification> {
  const issues: string[] = []
  if (capsule.algorithm !== 'SHA-256') issues.push('Unsupported digest algorithm')
  if (capsule.payload.schemaVersion !== 1) issues.push('Unsupported capsule schema version')
  const digest = await sha256(canonicalize(capsule.payload))
  const digestMatches = digest === capsule.digest
  if (!digestMatches) issues.push('Capsule payload digest mismatch')
  let resultMatches = false
  try {
    const recomputed = runScenario(capsule.payload.baseline, capsule.payload.scenario)
    resultMatches = canonicalize(recomputed) === canonicalize(capsule.payload.result)
    if (!resultMatches) issues.push('Stored result differs from deterministic replay')
  } catch {
    issues.push('Capsule inputs failed scenario validation')
  }
  return { valid: issues.length === 0 && digestMatches && resultMatches, digestMatches, resultMatches, issues }
}
