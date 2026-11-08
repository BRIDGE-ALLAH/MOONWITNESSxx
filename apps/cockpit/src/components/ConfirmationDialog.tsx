'use client'
import React, { useEffect, useRef, useState } from 'react'
import { findAction } from '../lib/actions'

export interface ConfirmationDialogProps {
  actionId: string | null
  source: 'operator' | 'copilot-draft'
  environment?: string
  onConfirm: () => void
  onCancel: () => void
  requireDualKey?: boolean
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ConfirmationDialog({
  actionId,
  source,
  environment,
  onConfirm,
  onCancel,
  requireDualKey = false,
}: ConfirmationDialogProps) {
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [secondaryKey, setSecondaryKey] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setInput('')
    setChecked(false)
    setSecondaryKey('')
  }, [actionId, source])

  useEffect(() => {
    if (!actionId) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const container = containerRef.current
    if (!container) return
    // initial focus
    const first = container.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const firstEl = nodes[0]
      const lastEl = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [actionId, onCancel])

  if (!actionId) return null
  const meta = findAction(actionId as any)
  if (!meta) return null
  const envLabel = environment ?? 'unknown'
  const required = meta.destructive
    ? (meta.token ?? 'CONFIRM LOCKDOWN')
    : meta.privileged
      ? actionId
      : null
  const isDualKeyNeeded = requireDualKey || (environment === 'production' && meta.destructive)
  const dualKeyValid = !isDualKeyNeeded || secondaryKey.trim().length >= 6
  const canConfirm = (required ? input === required : checked) && dualKeyValid
  const mismatch = !!required && input.length > 0 && input !== required

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Confirm ${actionId}`}
    >
      <div
        ref={containerRef}
        className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <h3 className="text-sm font-bold text-white">{meta.label}</h3>
        <p className="mt-2 text-xs text-slate-400">
          Action: <span className="font-mono">{actionId}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Environment: <span className="font-mono text-slate-200">{envLabel}</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Source: {source}. Confirmation is required before dispatch intent is recorded.
        </p>
        <p className="mt-2 text-xs text-slate-300">
          Read-back: You are confirming <span className="font-mono">{actionId}</span> in{' '}
          <span className="font-mono">{envLabel}</span> from{' '}
          <span className="font-mono">{source}</span>.
        </p>
        <p className="mt-2 rounded border border-slate-700 bg-slate-950/40 p-2 text-[11px] text-amber-300">
          Impact:{' '}
          {meta.destructive
            ? 'Destructive system control'
            : meta.privileged
              ? 'Privileged cache/socket operation'
              : 'Diagnostic only'}
          . Intent recorded only — no execution.
        </p>
        {meta.destructive ? (
          <p className="mt-2 rounded border border-rose-800/40 bg-rose-950/30 p-2 text-[11px] text-rose-300">
            Destructive/privileged control. Type the exact token to authorize this draft intent.
          </p>
        ) : null}
        {required ? (
          <div className="mt-3">
            <label htmlFor="confirm-token" className="text-xs text-slate-400">
              Type <span className="font-mono text-slate-200">{required}</span>
            </label>
            <input
              id="confirm-token"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {mismatch ? (
              <p className="mt-1 text-[11px] text-rose-300">
                Typed value does not match required token.
              </p>
            ) : null}
          </div>
        ) : (
          <label className="mt-3 flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have reviewed current telemetry and explicitly confirm this diagnostic action.
            </span>
          </label>
        )}
        {isDualKeyNeeded ? (
          <div className="mt-3 rounded border border-amber-800/40 bg-amber-950/20 p-2.5">
            <label htmlFor="secops-token" className="text-xs font-semibold text-amber-300">
              Dual-Key Approval Required (SecOps Lead Token)
            </label>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Production destructive operations require authorization by a secondary SecOps officer.
            </p>
            <input
              id="secops-token"
              type="password"
              placeholder="Enter 6+ character SecOps key"
              value={secondaryKey}
              onChange={(e) => setSecondaryKey(e.target.value)}
              className="mt-1.5 w-full rounded border border-amber-700/60 bg-slate-950 p-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="min-h-[40px] rounded border border-cyan-700 bg-cyan-950/40 px-3 py-1 text-xs text-cyan-100 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
