import type { ScenarioDefinition, ScenarioMetric, ScenarioResult } from '../scenario-forge/types'

export type ReplayCapsulePayload = {
  schemaVersion: 1
  engineVersion: string
  baseline: readonly ScenarioMetric[]
  scenario: ScenarioDefinition
  result: ScenarioResult
}

export type ReplayCapsule = {
  algorithm: 'SHA-256'
  digest: string
  payload: ReplayCapsulePayload
}

export type ReplayVerification = {
  valid: boolean
  digestMatches: boolean
  resultMatches: boolean
  issues: string[]
}
