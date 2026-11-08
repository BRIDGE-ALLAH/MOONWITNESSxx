'use client'
import React, { useCallback, useEffect, useMemo, useState, useId } from 'react'
import {
  exportAuditJsonl,
  filterAuditEvents,
  readAudit,
  type AuditEvent,
  type AuditEventType,
  type AuditFilters,
} from '../lib/audit'

const TYPES: AuditEventType[] = [
  'action-requested',
  'action-confirmed',
  'action-cancelled',
  'execution-marker',
  'copilot-draft',
  'provider-switch',
  'telemetry-degraded',
]

const SOURCES: Array<'operator' | 'copilot-draft' | 'system'> = [
  'operator',
  'copilot-draft',
  'system',
]
const RESULTS: Array<'approved' | 'denied' | 'executed' | 'error'> = [
  'approved',
  'denied',
  'executed',
  'error',
]

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id
}

export function AuditTrail({ refreshToken }: { refreshToken?: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [filters, setFilters] = useState<AuditFilters>({})
  const [focusedCorrelation, setFocusedCorrelation] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const typeId = useId()
  const actionIdId = useId()
  const sourceId = useId()
  const envId = useId()
  const resultId = useId()
  const queryId = useId()

  const refresh = useCallback(async () => setEvents(await readAudit(100)), [])

  useEffect(() => {
    refresh()
  }, [refresh, refreshToken])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }, [])

  const activeFilters = useMemo<AuditFilters>(
    () => ({ ...filters, correlationId: focusedCorrelation ?? undefined }),
    [filters, focusedCorrelation]
  )
  const filtered = useMemo(() => filterAuditEvents(events, activeFilters), [events, activeFilters])

  const hasAnyFilter = useMemo(
    () => Object.values(activeFilters).some((v) => v != null && v !== ''),
    [activeFilters]
  )

  const clearFilters = useCallback(() => {
    setFilters({})
    setFocusedCorrelation(null)
  }, [])

  const setFocused = useCallback((id: string | null) => {
    setFocusedCorrelation(id)
  }, [])

  const handleExport = useCallback(() => {
    setExporting(true)
    try {
      const blob = new Blob([exportAuditJsonl(filtered)], {
        type: 'application/x-ndjson; charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cockpit-audit-${new Date().toISOString().slice(0, 10)}.jsonl`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally {
      setExporting(false)
    }
  }, [filtered])

  return (
    <section
      className="rounded border border-slate-800 bg-slate-900/80 p-4"
      aria-label="Audit trail"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Audit Trail</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Persistent local/desktop intent log. No real system execution.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="min-h-[36px] rounded border border-slate-700 bg-slate-800 px-3 text-xs text-cyan-300 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2" role="region" aria-label="Filters">
        <label htmlFor={typeId} className="text-[10px] text-slate-500">
          Type
        </label>
        <select
          id={typeId}
          value={filters.type ?? ''}
          onChange={(e) => setFilter('type', e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <label htmlFor={actionIdId} className="text-[10px] text-slate-500">
          Action
        </label>
        <input
          id={actionIdId}
          value={filters.actionId ?? ''}
          onChange={(e) => setFilter('actionId', e.target.value)}
          placeholder="action id"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
        />

        <label htmlFor={sourceId} className="text-[10px] text-slate-500">
          Source
        </label>
        <select
          id={sourceId}
          value={filters.source ?? ''}
          onChange={(e) => setFilter('source', e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label htmlFor={envId} className="text-[10px] text-slate-500">
          Environment
        </label>
        <input
          id={envId}
          value={filters.environment ?? ''}
          onChange={(e) => setFilter('environment', e.target.value)}
          placeholder="env"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
        />

        <label htmlFor={resultId} className="text-[10px] text-slate-500">
          Result
        </label>
        <select
          id={resultId}
          value={filters.result ?? ''}
          onChange={(e) => setFilter('result', e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          <option value="">All</option>
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label htmlFor={queryId} className="text-[10px] text-slate-500">
          Correlation / text
        </label>
        <input
          id={queryId}
          value={filters.query ?? ''}
          onChange={(e) => setFilter('query', e.target.value)}
          placeholder="correlation id or keyword"
          className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none min-w-[140px]"
        />

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-[36px] rounded border border-slate-700 bg-slate-800 px-3 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            Clear filters
          </button>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="min-h-[36px] rounded border border-cyan-700/50 bg-cyan-950/30 px-3 text-[11px] text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-900/40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label={
            exporting ? 'Preparing JSONL download' : 'Download filtered audit events as JSONL'
          }
        >
          {exporting ? 'Downloading…' : 'Download JSONL'}
        </button>

        {focusedCorrelation && (
          <span className="flex items-center gap-1.5 rounded border border-cyan-800/40 bg-cyan-950/40 px-2 py-1.5 text-[11px] text-cyan-300">
            Chain: {shortId(focusedCorrelation)} (
            {filtered.filter((e) => e.correlationId === focusedCorrelation).length} events)
            <button
              type="button"
              onClick={() => setFocused(null)}
              className="rounded bg-cyan-900/60 text-[10px] leading-none px-1.5 text-cyan-200 hover:bg-cyan-700"
              aria-label="Clear correlation chain filter"
            >
              ×
            </button>
          </span>
        )}
      </div>

      {events.length > 0 && (
        <div className="mb-1 text-[10px] text-slate-500">
          Showing <span className="text-slate-200 font-bold">{filtered.length}</span> of{' '}
          <span className="text-slate-200 font-bold">{events.length}</span> events
          {hasAnyFilter ? ' (filtered)' : ''}
        </div>
      )}

      <div className="max-h-64 overflow-auto rounded border border-slate-800">
        <table
          className="w-full text-left text-[11px] font-mono text-slate-300"
          aria-label="Audit events"
        >
          <thead className="sticky top-0 bg-slate-950/95 text-slate-500">
            <tr>
              <th className="px-2 py-2 font-normal">Timestamp</th>
              <th className="px-2 py-2 font-normal">Type</th>
              <th className="px-2 py-2 font-normal">Action</th>
              <th className="px-2 py-2 font-normal">Source</th>
              <th className="px-2 py-2 font-normal">Correlation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-slate-500">
                  {events.length === 0
                    ? 'No audit events recorded.'
                    : 'No audit events match the current filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr
                  key={e.id}
                  className={`border-t border-slate-800/80 align-top ${focusedCorrelation && e.correlationId === focusedCorrelation ? 'bg-cyan-950/25 ring-1 ring-cyan-500/40' : ''}`}
                >
                  <td className="px-2 py-2 text-slate-400">{e.ts}</td>
                  <td className="px-2 py-2">{e.type}</td>
                  <td className="px-2 py-2">{e.actionId ?? '—'}</td>
                  <td className="px-2 py-2">{e.source ?? e.actor ?? '—'}</td>
                  <td className="px-2 py-2">
                    {e.correlationId ? (
                      <button
                        type="button"
                        onClick={() => setFocused(e.correlationId ?? null)}
                        className={`${focusedCorrelation === e.correlationId ? 'text-cyan-400 underline' : 'text-cyan-300 hover:underline'}`}
                        aria-label={
                          focusedCorrelation === e.correlationId
                            ? `Focused on chain ${shortId(e.correlationId)}`
                            : `Show chain ${shortId(e.correlationId)}`
                        }
                      >
                        {e.correlationId}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
