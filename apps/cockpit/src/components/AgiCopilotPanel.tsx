'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { CockpitSnapshot, CopilotResponse, SuggestedAction } from '../lib/agiCopilot'
import {
  analyzeCopilotProvider,
  type CopilotProviderId,
  probeKeyStatus,
  saveKey as saveKeyToKeychain,
} from '../lib/copilot'
import { appendAudit } from '../lib/audit'
import { isTauri } from '../lib/tauri'

export interface AgiCopilotPanelProps {
  open: boolean
  onClose: () => void
  snapshot: CockpitSnapshot
  onDraftAction: (action: SuggestedAction, correlationId?: string) => void | Promise<void>
}

const QUICK_PROMPTS = [
  'Explain degraded nodes',
  'Suggest next diagnostic',
  'Summarize system state',
]

function confidenceClass(confidence: CopilotResponse['confidence']): string {
  if (confidence === 'High') return 'text-emerald-300 border-emerald-700/50 bg-emerald-950/30'
  if (confidence === 'Medium') return 'text-amber-300 border-amber-700/50 bg-amber-950/30'
  return 'text-slate-300 border-slate-700/50 bg-slate-900/60'
}

export function AgiCopilotPanel({ open, onClose, snapshot, onDraftAction }: AgiCopilotPanelProps) {
  const [question, setQuestion] = useState('')
  const [responses, setResponses] = useState<CopilotResponse[]>([])
  const [liveMessage, setLiveMessage] = useState('')
  const [provider, setProvider] = useState<CopilotProviderId>('local-heuristic')
  const [apiKey, setApiKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const tauriMode = isTauri()

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    if (provider !== 'remote-llm' || !tauriMode) {
      setKeyStatus(
        tauriMode ? '' : 'Keychain unavailable in web mode; remote provider uses local fallback.'
      )
      return
    }
    let cancelled = false
    probeKeyStatus()
      .then((status) => {
        if (!cancelled)
          setKeyStatus(
            `Key status: ${status}. Storage: OS keychain via Tauri, service moonwitness-cockpit, account llm-api-key (never localStorage).`
          )
      })
      .catch((error) => {
        if (!cancelled)
          setKeyStatus(
            `Key status: unknown (${error instanceof Error ? error.message : String(error)}).`
          )
      })
    return () => {
      cancelled = true
    }
  }, [open, provider, tauriMode])

  const submit = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setLiveMessage('Analyzing snapshot...')
    try {
      const response = await analyzeCopilotProvider(snapshot, trimmed, provider)
      setResponses((prev) => [
        { ...response, answer: `Q: ${trimmed}\n${response.answer}` },
        ...prev,
      ])
      setLiveMessage(
        `AI response ready from ${response.provider}${response.model ? ` (${response.model})` : ''} with ${response.confidence} confidence.`
      )
      setQuestion('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setLiveMessage(`Copilot analysis failed: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const saveKey = async () => {
    if (!tauriMode) {
      setKeyStatus('Keychain save is only available in the Tauri desktop runtime.')
      return
    }
    const value = apiKey.trim()
    if (!value) {
      setKeyStatus('Enter an API key before saving.')
      return
    }
    try {
      await saveKeyToKeychain(value)
      setApiKey('')
      const status = await probeKeyStatus().catch(() => 'unknown')
      setKeyStatus(
        `Key status: ${status}. Storage: OS keychain via Tauri, service moonwitness-cockpit, account llm-api-key (never localStorage).`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setKeyStatus(`Keychain save failed: ${message}`)
    }
  }

  const requestDraftAction = async (action: SuggestedAction) => {
    const correlationId = crypto.randomUUID()
    await appendAudit({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      type: 'copilot-draft',
      actionId: action.actionId,
      source: 'copilot-draft',
      environment: snapshot.environment,
      correlationId,
      metadata: { provider, label: action.label },
    })
    await onDraftAction(action, correlationId)
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/40" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI Copilot panel"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-slate-950/98 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                AI Copilot / AGI Assist
              </h2>
              <span className="rounded border border-cyan-700/50 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                AI ASSIST
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Assistive only, not authoritative. Uses current cockpit snapshot. Remote LLM is
              optional and may be unavailable; local heuristic remains default. Action drafts
              require explicit human confirmation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded border border-slate-700 bg-slate-900 px-3 text-xs font-mono text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Close AI Copilot panel"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-800 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-mono text-slate-400">
              Provider
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as CopilotProviderId)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="local-heuristic">local-heuristic (default)</option>
                <option value="remote-llm">remote-llm (optional)</option>
              </select>
            </label>
            <div className="text-xs font-mono text-slate-400">
              Status
              <div className="mt-1 rounded border border-slate-800 bg-slate-900 p-2 text-[11px] text-slate-300">
                {provider === 'remote-llm'
                  ? tauriMode
                    ? 'Remote LLM uses Tauri llm_analyze with OS keychain secret `llm-api-key`. Fallback to local on error.'
                    : 'Remote LLM provider is not configured in web mode; local fallback will be used.'
                  : 'Local heuristic uses in-memory snapshot analysis only.'}
              </div>
            </div>
          </div>

          {provider === 'remote-llm' ? (
            <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
              <label htmlFor="agi-copilot-key" className="block text-xs font-mono text-slate-400">
                Tauri keychain secret (transient)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="agi-copilot-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={tauriMode ? 'llm-api-key value' : 'Available in Tauri mode only'}
                  className="min-h-[40px] w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={saveKey}
                  disabled={!tauriMode}
                  className="min-h-[40px] rounded border border-cyan-700/50 bg-cyan-950/30 px-3 text-xs font-mono text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-50"
                >
                  Save key
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Never persisted to localStorage. Input is cleared after successful save.
              </p>
              {keyStatus ? <p className="mt-1 text-[11px] text-slate-300">{keyStatus}</p> : null}
            </div>
          ) : null}

          <label
            htmlFor="agi-copilot-question"
            className="mb-1 block text-xs font-mono text-slate-400"
          >
            Operator question
          </label>
          <textarea
            id="agi-copilot-question"
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="Ask about degraded nodes, diagnostics, or an action draft."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(question)}
              className="min-h-[44px] rounded border border-cyan-700/50 bg-cyan-950/40 px-3 text-xs font-mono text-cyan-200 transition hover:bg-cyan-900/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            >
              {busy ? 'Analyzing…' : 'Analyze snapshot'}
            </button>
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={busy}
                onClick={() => void submit(prompt)}
                className="min-h-[44px] rounded border border-slate-700 bg-slate-900 px-3 text-xs font-mono text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {responses.length === 0 ? (
            <div className="rounded border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-400">
              <p className="font-mono text-xs uppercase tracking-wider text-slate-500">
                Empty state
              </p>
              <p className="mt-2">
                No copilot responses yet. Ask a question or use a quick prompt to generate an
                evidence-linked analysis from the current snapshot.
              </p>
            </div>
          ) : null}

          {responses.map((response, idx) => (
            <article
              key={`${response.provider}-${response.model ?? 'na'}-${idx}-${response.confidence}`}
              className="rounded border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded border border-cyan-700/50 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                  AI
                </span>
                <span className="rounded border border-slate-700 bg-slate-950/50 px-2 py-0.5 text-[10px] font-mono text-slate-200">
                  Provider: {response.provider}
                  {response.model ? ` / ${response.model}` : ''}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-mono ${confidenceClass(response.confidence)}`}
                >
                  Confidence: {response.confidence}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{response.answer}</p>
              <p className="mt-2 text-[11px] text-slate-500">{response.disclaimer}</p>
              {response.fallbackReason ? (
                <p className="mt-2 text-[11px] text-amber-300" role="status">
                  Fallback: {response.fallbackReason}
                </p>
              ) : null}

              <div className="mt-3">
                <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Citations
                </h3>
                {response.citations.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-[11px] font-mono text-slate-400">
                    {response.citations.map((citation, cidx) => (
                      <li
                        key={`${citation}-${cidx}`}
                        className="rounded border border-slate-800/80 bg-slate-950/50 px-2 py-1"
                      >
                        {citation}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    No telemetry citations available.
                  </p>
                )}
              </div>

              {response.suggestedActions.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Draft actions (confirmation required)
                  </h3>
                  <div className="mt-2 space-y-2">
                    {response.suggestedActions.map((action) => (
                      <div
                        key={action.actionId}
                        className="rounded border border-slate-800 bg-slate-950/50 p-2"
                      >
                        <p className="text-xs text-slate-200">{action.label}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{action.reason}</p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void requestDraftAction(action)}
                          className="mt-2 min-h-[44px] rounded border border-amber-700/50 bg-amber-950/30 px-3 text-xs font-mono text-amber-200 transition hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          Request confirmation
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </aside>
    </>
  )
}
