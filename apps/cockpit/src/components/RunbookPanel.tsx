'use client'

import React from 'react'
import type { ActionId } from '../lib/actions'
import { type RunbookRecommendation, type RunbookSnapshot, generateRunbooks } from '../lib/runbooks'

export interface RunbookPanelProps {
  snapshot: RunbookSnapshot
  /** Routes a draft action through the existing confirmation + audit path (gates apply). */
  onDispatchDraft: (actionId: ActionId) => void
}

function severityClass(severity: RunbookRecommendation['severity']): string {
  if (severity === 'critical') {
    return 'text-rose-400 border-rose-800/40 bg-rose-950/30'
  }
  if (severity === 'warning') {
    return 'text-amber-400 border-amber-800/40 bg-amber-950/30'
  }
  return 'text-cyan-400 border-cyan-800/40 bg-cyan-950/30'
}

export function RunbookPanel({ snapshot, onDispatchDraft }: RunbookPanelProps) {
  const recommendations = generateRunbooks(snapshot)

  const handleDraft = (actionId: ActionId): void => {
    onDispatchDraft(actionId)
  }

  return (
    <section
      className="rounded border border-slate-800 bg-slate-900/80 p-4"
      aria-label="Runbook recommendations"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Runbook Recommendations
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Draft-only — no autonomous execution. Every draft action requires explicit confirmation
            before any intent is recorded.
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-500">
          {recommendations.length} recommendation{recommendations.length === 1 ? '' : 's'}
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="rounded border border-slate-800/80 bg-slate-950/50 p-4 text-sm text-slate-400">
          <p className="font-mono text-xs uppercase tracking-wider text-slate-500">Empty state</p>
          <p className="mt-2">
            No runbook recommendations. Current snapshot shows no actionable conditions.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <article key={rec.id} className="rounded border border-slate-800 bg-slate-900/60 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-mono ${severityClass(
                  rec.severity
                )}`}
              >
                {rec.severity.toUpperCase()}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-200">{rec.title}</h4>
            <p className="mt-1 text-xs text-slate-300 whitespace-pre-wrap">{rec.observed}</p>

            <div className="mt-3">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Evidence
              </h5>
              <ul className="mt-1 space-y-1 text-[11px] font-mono text-slate-400">
                {rec.citations.map((citation, idx) => (
                  <li
                    key={idx}
                    className="rounded border border-slate-800/80 bg-slate-950/50 px-2 py-1"
                  >
                    {citation}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Safe next steps
              </h5>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                {rec.nextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            {rec.draftActions.length > 0 ? (
              <div className="mt-4">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Draft actions (confirmation required)
                </h5>
                <div className="mt-2 space-y-2">
                  {rec.draftActions.map((action) => (
                    <div
                      key={action.actionId}
                      className="rounded border border-slate-800 bg-slate-950/50 p-2"
                    >
                      <p className="text-xs text-slate-200">{action.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{action.note}</p>
                      <button
                        type="button"
                        onClick={() => handleDraft(action.actionId)}
                        aria-label={`Draft ${action.actionId} — requires confirmation`}
                        className="mt-2 w-full rounded border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-xs font-mono text-amber-200 transition hover:bg-amber-900/40 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        Draft — requires confirmation
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
