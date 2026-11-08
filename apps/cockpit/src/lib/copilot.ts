import { analyzeCopilot as localAnalyze } from './agiCopilot.ts'
import type { CockpitSnapshot, CopilotResponse } from './agiCopilot.ts'
import { isTauri, invoke } from './tauri.ts'
import { appendAudit } from './audit.ts'

export type CopilotProviderId = 'local-heuristic' | 'remote-llm'

export const COPILOT_KEYCHAIN_SERVICE = 'moonwitness-cockpit'
export const COPILOT_KEYCHAIN_ACCOUNT = 'llm-api-key'

export type KeyStatus = 'unknown' | 'configured' | 'missing'

/**
 * Probe the OS keychain for the configured LLM secret. Only meaningful in Tauri;
 * outside Tauri the keychain is unreachable and we report `unknown` rather than
 * inventing a state. Errors are surfaced as `unknown` so callers never hang.
 */
export async function probeKeyStatus(): Promise<KeyStatus> {
  if (!isTauri()) return 'unknown'
  try {
    const value = await invoke<string | null>('keychain_get', { account: COPILOT_KEYCHAIN_ACCOUNT })
    return value && value.length > 0 ? 'configured' : 'missing'
  } catch {
    return 'unknown'
  }
}

/**
 * Save the LLM API key to the OS keychain via Tauri. Uses the canonical
 * { account, secret } shape matching the Rust keychain_set command.
 */
export async function saveKey(secret: string): Promise<void> {
  if (!isTauri()) throw new Error('Keychain save is only available in the Tauri desktop runtime.')
  const value = secret.trim()
  if (!value) throw new Error('Enter an API key before saving.')
  await invoke('keychain_set', { account: COPILOT_KEYCHAIN_ACCOUNT, secret: value })
}

export interface AnalyzeCopilotOptions {
  stream?: boolean
  correlationId?: string
}

export async function analyzeCopilotProvider(
  snapshot: CockpitSnapshot,
  question: string,
  provider: CopilotProviderId,
  options: AnalyzeCopilotOptions = {}
): Promise<CopilotResponse> {
  const { stream = false, correlationId } = options
  if (provider === 'local-heuristic') {
    return localAnalyze(snapshot, question)
  }
  // remote
  if (isTauri()) {
    const command = stream ? 'llm_analyze_stream' : 'llm_analyze'
    try {
      const res = await invoke<CopilotResponse>(command, { snapshot, question })
      return { ...res, provider: 'remote-llm' }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      await appendAudit({
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        type: 'provider-switch',
        correlationId,
        metadata: {
          from: stream ? 'remote-llm-stream' : 'remote-llm',
          to: 'local-heuristic',
          reason: message,
        },
      })
      const r = localAnalyze(snapshot, question)
      return {
        ...r,
        provider: 'local-heuristic',
        fallbackReason: `Remote LLM unavailable (${message}); used local heuristic.`,
      }
    }
  }
  const r = localAnalyze(snapshot, question)
  return {
    ...r,
    provider: 'local-heuristic',
    fallbackReason:
      'Remote LLM is not available outside the Tauri desktop runtime; used local heuristic.',
  }
}

// backward compat: keep analyzeCopilot export name pointing to local
export { localAnalyze as analyzeCopilot }
