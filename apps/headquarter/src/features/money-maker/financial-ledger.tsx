'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type FinancialEvent = {
  id: string
  productId: string | null
  eventType: string
  amountMinor: string
  currency: string
  occurredAt: string
  recordedAt: string
  source: string
  providerReference: string | null
  reconciliationState: 'pending' | 'verified' | 'disputed' | 'reversed'
}
type FinancialSummary = {
  currency: string
  gross_receipts_minor: string
  deductions_minor: string
  payout_movements_minor: string
  pending_minor: string
  pending_count: string
  net_contribution_minor: string
}
type Product = { id: string; title: string; version: number }

const eventTypes = [
  ['gross-receipt', 'Gross receipt'], ['platform-fee', 'Platform fee'],
  ['refund', 'Refund'], ['chargeback', 'Chargeback'], ['variable-cost', 'Variable cost'],
  ['production-cost', 'Production cost'], ['tax-reserve', 'Tax reserve'],
  ['payout', 'Payout'], ['payout-reversal', 'Payout reversal'],
] as const

export function FinancialLedger() {
  const [events, setEvents] = useState<FinancialEvent[]>([])
  const [summary, setSummary] = useState<FinancialSummary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [reconcilingId, setReconcilingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reconciliation, setReconciliation] = useState<Record<string, { state: 'verified' | 'disputed' | 'reversed'; rationale: string; evidenceUrl: string }>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [eventResponse, summaryResponse, productResponse] = await Promise.all([
        fetch('/api/financial-events', { cache: 'no-store' }),
        fetch('/api/financial-summary', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
      ])
      const [eventPayload, summaryPayload, productPayload] = await Promise.all([
        eventResponse.json(), summaryResponse.json(), productResponse.json(),
      ])
      if ([eventResponse, summaryResponse, productResponse].some((response) => response.status === 401)) {
        throw new Error('Operator login required. Sign in at /login.')
      }
      if (!eventResponse.ok) throw new Error(eventPayload.error?.message || 'Unable to load financial events.')
      if (!summaryResponse.ok) throw new Error(summaryPayload.error?.message || 'Unable to load financial summary.')
      if (!productResponse.ok) throw new Error(productPayload.error?.message || 'Unable to load product records.')
      setEvents(eventPayload.data ?? [])
      setSummary(summaryPayload.data ?? [])
      setProducts(productPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load financial data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function recordEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const occurredAt = new Date(String(data.get('occurredAt') || '')).toISOString()
      const stableIdempotencyKey = idempotencyKey || `manual-${crypto.randomUUID()}`
      setIdempotencyKey(stableIdempotencyKey)
      const response = await fetch('/api/financial-events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId: String(data.get('productId') || '') || undefined,
          eventType: String(data.get('eventType') || ''),
          amountMinor: String(data.get('amountMinor') || ''),
          currency: String(data.get('currency') || '').toUpperCase(),
          occurredAt,
          source: String(data.get('source') || ''),
          providerReference: String(data.get('providerReference') || '') || undefined,
          idempotencyKey: stableIdempotencyKey,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record financial event.')
      form.reset()
      setIdempotencyKey('')
      setMessage(payload.replayed ? 'Existing event returned for this idempotency key.' : 'Financial event recorded as pending reconciliation.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record financial event.')
    } finally {
      setSaving(false)
    }
  }

  async function reconcileEvent(item: FinancialEvent) {
    const input = reconciliation[item.id]
    if (!input?.rationale.trim() || !input.evidenceUrl.trim()) {
      setError('A reconciliation rationale and evidence URL are required.')
      return
    }
    setReconcilingId(item.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/financial-events/${item.id}/reconciliation`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to reconcile financial event.')
      setMessage(`Financial event ${item.id} updated to ${input.state}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reconcile financial event.')
    } finally {
      setReconcilingId('')
    }
  }

  return <div className="space-y-8">
    {error && <div role="alert" className="border border-red-500/50 bg-red-950/20 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4"><div><h2 className="font-display text-2xl uppercase">Verified summary</h2><p className="text-xs text-muted-ink">Calculated from persisted events only · amounts remain in currency minor units</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading financial records…</p>
        : summary.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No financial events have been recorded. No revenue or balance is assumed.</p>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summary.map((row) => <article key={row.currency} className="border border-acid-lime/20 bg-panel-charcoal p-4"><h3 className="font-display text-xl uppercase">{row.currency}</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-ink">Gross receipts · verified</dt><dd className="mt-1 font-mono">{row.gross_receipts_minor}</dd></div><div><dt className="text-muted-ink">Deductions · verified</dt><dd className="mt-1 font-mono">{row.deductions_minor}</dd></div><div><dt className="text-muted-ink">Net contribution · verified</dt><dd className="mt-1 font-mono text-acid-lime">{row.net_contribution_minor}</dd></div><div><dt className="text-muted-ink">Pending events</dt><dd className="mt-1 font-mono">{row.pending_count} · {row.pending_minor}</dd></div><div><dt className="text-muted-ink">Payout movements</dt><dd className="mt-1 font-mono">{row.payout_movements_minor}</dd></div></dl></article>)}</div>}
    </section>

    <section className="space-y-3">
      <div><h2 className="font-display text-2xl uppercase">Financial event register</h2><p className="text-xs text-muted-ink">Manual source-backed entry. Retries reuse the same idempotency key until success. New events are pending until reconciled; they are not automatically treated as revenue.</p></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading events…</p>
        : events.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No financial events recorded yet.</p>
        : <div className="space-y-3">{events.map((item) => <article key={item.id} className="border border-acid-lime/20 bg-panel-charcoal p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-mono text-sm uppercase">{item.eventType.replaceAll('-', ' ')}</h3><p className="mt-1 text-xs text-muted-ink">{item.source} · {new Date(item.occurredAt).toLocaleString()}</p><p className="mt-1 break-all text-[10px] text-muted-ink">ID: {item.id}{item.providerReference ? ` · REF: ${item.providerReference}` : ''}</p></div><div className="text-right"><p className="font-mono text-lg">{item.currency} {item.amountMinor}</p><p className="text-[10px] font-mono uppercase text-acid-lime">{item.reconciliationState}</p></div></div>
          {item.reconciliationState === 'pending' && <div className="mt-4 grid gap-2 border-t border-acid-lime/20 pt-3 md:grid-cols-2"><label className="text-xs font-mono uppercase">Reconciliation state<select value={reconciliation[item.id]?.state ?? 'verified'} onChange={(event) => setReconciliation((values) => ({ ...values, [item.id]: { state: event.target.value as 'verified' | 'disputed' | 'reversed', rationale: values[item.id]?.rationale ?? '', evidenceUrl: values[item.id]?.evidenceUrl ?? '' } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="verified">Verified</option><option value="disputed">Disputed</option><option value="reversed">Reversed</option></select></label><label className="text-xs font-mono uppercase">Evidence URL<input type="url" value={reconciliation[item.id]?.evidenceUrl ?? ''} onChange={(event) => setReconciliation((values) => ({ ...values, [item.id]: { state: values[item.id]?.state ?? 'verified', rationale: values[item.id]?.rationale ?? '', evidenceUrl: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><label className="text-xs font-mono uppercase md:col-span-2">Reconciliation rationale<textarea value={reconciliation[item.id]?.rationale ?? ''} onChange={(event) => setReconciliation((values) => ({ ...values, [item.id]: { state: values[item.id]?.state ?? 'verified', rationale: event.target.value, evidenceUrl: values[item.id]?.evidenceUrl ?? '' } }))} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><div className="md:col-span-2"><button type="button" disabled={reconcilingId === item.id} onClick={() => void reconcileEvent(item)} className="border border-acid-lime px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-50">{reconcilingId === item.id ? 'Reconciling…' : 'Save reconciliation'}</button></div></div>}
        </article>)}</div>}
    </section>

    <form onSubmit={recordEvent} onChange={() => { if (idempotencyKey) setIdempotencyKey('') }} className="space-y-4 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7">
      <div><h2 className="font-display text-2xl uppercase">Record financial event</h2><p className="text-xs text-muted-ink">Use exact source values and a real provider or statement reference. Amount is an integer in minor units; no conversion or estimate is performed.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs font-mono uppercase">Event type<select name="eventType" required className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs">{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Product (optional)<select name="productId" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="">Unassigned</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title} · v{product.version}</option>)}</select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Amount · minor units<input name="amountMinor" inputMode="numeric" pattern="[1-9][0-9]{0,17}" required placeholder="50000" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">ISO currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="IDR" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm uppercase" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Occurred at<input name="occurredAt" type="datetime-local" required className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Source<input name="source" required minLength={2} maxLength={200} placeholder="Bank statement / provider report" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Provider reference (optional)<input name="providerReference" maxLength={300} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
      </div>
      <button type="submit" disabled={saving} className="border border-acid-lime bg-acid-lime px-6 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Recording…' : 'Record pending financial event'}</button>
    </form>
  </div>
}
