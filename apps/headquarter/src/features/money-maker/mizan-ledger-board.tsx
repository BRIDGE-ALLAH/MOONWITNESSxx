'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type FinancialEvent = {
  id: string
  productId: string | null
  eventType: string
  amountMinor: string
  currency: string
  occurredAt: string
  source: string
  providerReference: string | null
  reconciliationState: 'pending' | 'verified' | 'disputed' | 'reversed'
  metadata: Record<string, unknown>
}
type Summary = {
  currency: string
  gross_receipts_minor: string
  deductions_minor: string
  payout_movements_minor: string
  pending_minor: string
  pending_count: string
  net_contribution_minor: string
}
type Product = { id: string; title: string }

function localDateTime() {
  const date = new Date()
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function MizanLedgerBoard() {
  const [events, setEvents] = useState<FinancialEvent[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reconcileDrafts, setReconcileDrafts] = useState<Record<string, { state: 'verified' | 'disputed' | 'reversed'; rationale: string; evidenceUrl: string }>>({})

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [eventResponse, summaryResponse, productResponse] = await Promise.all([
        fetch('/api/financial-events', { cache: 'no-store' }),
        fetch('/api/financial-summary', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
      ])
      const [eventPayload, summaryPayload, productPayload] = await Promise.all([eventResponse.json(), summaryResponse.json(), productResponse.json()])
      if ([eventResponse, summaryResponse, productResponse].some((response) => response.status === 401)) throw new Error('Operator login required. Sign in at /login.')
      if (!eventResponse.ok || !summaryResponse.ok || !productResponse.ok) throw new Error(eventPayload.error?.message || summaryPayload.error?.message || productPayload.error?.message || 'Unable to load ledger.')
      setEvents(eventPayload.data ?? [])
      setSummary(summaryPayload.data ?? [])
      setProducts(productPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load ledger.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving(true); setError(''); setMessage('')
    try {
      const amountMinor = String(data.get('amountMinor') || '')
      if (!/^[1-9][0-9]{0,17}$/.test(amountMinor)) throw new Error('Amount must be a positive integer in currency minor units.')
      const occurredAt = new Date(String(data.get('occurredAt') || '')).toISOString()
      const payload = {
        productId: String(data.get('productId') || '') || undefined,
        eventType: String(data.get('eventType') || 'gross-receipt'),
        amountMinor,
        currency: String(data.get('currency') || 'IDR').toUpperCase(),
        occurredAt,
        source: String(data.get('source') || ''),
        providerReference: String(data.get('providerReference') || '') || undefined,
        idempotencyKey: globalThis.crypto.randomUUID(),
      }
      const response = await fetch('/api/financial-events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(result.error?.message || 'Unable to record financial event.')
      form.reset()
      setMessage(result.replayed ? 'Existing event returned (idempotent replay).' : 'Event recorded as PENDING. It is excluded from verified contribution until reconciled.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record financial event.')
    } finally { setSaving(false) }
  }

  async function reconcile(eventId: string) {
    const draft = reconcileDrafts[eventId]
    if (!draft?.rationale.trim() || !draft.evidenceUrl.trim()) {
      setError('A reconciliation rationale and evidence URL are required.')
      return
    }
    setError(''); setMessage('')
    try {
      const response = await fetch(`/api/financial-events/${eventId}/reconciliation`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(result.error?.message || 'Unable to reconcile event.')
      setMessage(`Event reconciled as ${draft.state.toUpperCase()}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reconcile event.')
    }
  }

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Financial Operations</p><h1 className="mt-3 font-display text-5xl uppercase">MIZAN LEDGER</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Exact integer minor units, immutable event history and evidence-based reconciliation. Pending entries are not counted as verified contribution. Payout transfers are shown separately from profit.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Verified contribution</h2><p className="text-xs text-muted-ink">Grouped by currency · values are integer minor units</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading financial records…</p> : summary.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No financial events yet. No revenue or profit is assumed.</p> : <div className="grid gap-3 md:grid-cols-2">{summary.map((row) => <article key={row.currency} className="border border-acid-lime/20 bg-panel-charcoal p-4"><h3 className="font-display text-xl">{row.currency}</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-ink">Gross receipts</dt><dd className="font-mono">{row.gross_receipts_minor}</dd></div><div><dt className="text-muted-ink">Deductions</dt><dd className="font-mono">{row.deductions_minor}</dd></div><div><dt className="text-muted-ink">Net contribution</dt><dd className="font-mono text-acid-lime">{row.net_contribution_minor}</dd></div><div><dt className="text-muted-ink">Payout movements</dt><dd className="font-mono">{row.payout_movements_minor}</dd></div><div><dt className="text-muted-ink">Pending amount</dt><dd className="font-mono">{row.pending_minor}</dd></div><div><dt className="text-muted-ink">Pending events</dt><dd className="font-mono">{row.pending_count}</dd></div></dl></article>)}</div>}
    </section>
    <form onSubmit={createEvent} className="space-y-4 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7"><div><h2 className="font-display text-2xl uppercase">Record financial event</h2><p className="text-xs text-muted-ink">New events always enter pending reconciliation. Use statement or provider evidence; never invent a sale or payout.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs font-mono uppercase">Event type<select name="eventType" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm"><option value="gross-receipt">Gross receipt</option><option value="platform-fee">Platform fee</option><option value="refund">Refund</option><option value="chargeback">Chargeback</option><option value="variable-cost">Variable cost</option><option value="production-cost">Production cost</option><option value="tax-reserve">Tax reserve</option><option value="fx-adjustment">FX adjustment</option><option value="payout">Payout</option><option value="payout-reversal">Payout reversal</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Related product<select name="productId" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm"><option value="">Not linked</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Amount (integer minor units)<input name="amountMinor" required inputMode="numeric" pattern="[1-9][0-9]{0,17}" placeholder="e.g. 125000 or 1250" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Currency<input name="currency" required minLength={3} maxLength={3} defaultValue="IDR" pattern="[A-Za-z]{3}" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm uppercase" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Occurred at<input name="occurredAt" type="datetime-local" required defaultValue={localDateTime()} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Source / evidence context<input name="source" required minLength={2} placeholder="Provider statement / invoice / receipt" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Provider reference (optional)<input name="providerReference" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
      </div>
      <p className="text-xs text-orange-200">Currency minor-unit scale varies by currency. IDR is typically entered as whole rupiah; USD and many other currencies use cents. Confirm the provider statement's currency and amount scale.</p>
      <button disabled={saving} className="bg-acid-lime px-6 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Recording…' : 'Record pending event'}</button>
    </form>
    <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Event journal</h2><p className="text-xs text-muted-ink">Only verified entries contribute to the summary above</p></div>
      {loading ? <p className="text-sm text-muted-ink">Loading…</p> : events.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">The journal is empty.</p> : events.map((item) => <article key={item.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-mono text-sm uppercase">{item.eventType}</h3><p className="mt-1 text-xs text-muted-ink">{item.source} · {new Date(item.occurredAt).toLocaleString()}</p></div><div className="text-right"><p className="font-mono text-lg">{item.currency} {item.amountMinor}</p><span className="text-[10px] font-mono uppercase text-orange-200">{item.reconciliationState}</span></div></div>
        {item.providerReference && <p className="text-xs text-muted-ink">Provider ref: {item.providerReference}</p>}
        {item.reconciliationState === 'pending' && <div className="grid gap-3 border-t border-acid-lime/10 pt-3 md:grid-cols-2"><label className="space-y-1 text-xs font-mono uppercase">Reconciliation result<select value={reconcileDrafts[item.id]?.state ?? 'verified'} onChange={(e) => setReconcileDrafts((v) => ({ ...v, [item.id]: { state: e.target.value as 'verified' | 'disputed' | 'reversed', rationale: v[item.id]?.rationale ?? '', evidenceUrl: v[item.id]?.evidenceUrl ?? '' } }))} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="verified">Verified</option><option value="disputed">Disputed</option><option value="reversed">Reversed</option></select></label><label className="space-y-1 text-xs font-mono uppercase">Evidence URL<input type="url" value={reconcileDrafts[item.id]?.evidenceUrl ?? ''} onChange={(e) => setReconcileDrafts((v) => ({ ...v, [item.id]: { state: v[item.id]?.state ?? 'verified', rationale: v[item.id]?.rationale ?? '', evidenceUrl: e.target.value } }))} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Rationale<textarea rows={2} value={reconcileDrafts[item.id]?.rationale ?? ''} onChange={(e) => setReconcileDrafts((v) => ({ ...v, [item.id]: { state: v[item.id]?.state ?? 'verified', rationale: e.target.value, evidenceUrl: v[item.id]?.evidenceUrl ?? '' } }))} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><button type="button" onClick={() => void reconcile(item.id)} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase md:col-span-2">Save reconciliation</button></div>}
      </article>)}
    </section>
  </div></main>
}
