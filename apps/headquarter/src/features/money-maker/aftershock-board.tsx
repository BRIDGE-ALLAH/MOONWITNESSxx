'use client'

import { useCallback, useEffect, useState } from 'react'

type Opportunity = { id: string; evaluation: { decision: string } }
type Product = { id: string; lifecycleState: string }
type Summary = {
  currency: string
  gross_receipts_minor: string
  deductions_minor: string
  payout_movements_minor: string
  pending_minor: string
  pending_count: string
  net_contribution_minor: string
}

export function AftershockBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const responses = await Promise.all([
        fetch('/api/opportunities', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/financial-summary', { cache: 'no-store' }),
      ])
      const payloads = await Promise.all(responses.map((response) => response.json()))
      if (responses.some((response) => response.status === 401)) throw new Error('Operator login required. Sign in at /login.')
      const failed = responses.findIndex((response) => !response.ok)
      if (failed >= 0) throw new Error(payloads[failed].error?.message || 'Unable to load portfolio performance.')
      setOpportunities(payloads[0].data ?? [])
      setProducts(payloads[1].data ?? [])
      setSummary(payloads[2].data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load portfolio performance.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  const prototypes = opportunities.filter((item) => item.evaluation.decision === 'prototype-candidate').length
  const briefs = products.filter((item) => item.lifecycleState === 'brief').length

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Portfolio Learning</p><h1 className="mt-3 font-display text-5xl uppercase">AFTERSHOCK</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Only persisted opportunities, product briefs and reconciled financial events are counted. Conversion rates and product lifetime remain unavailable until real cohorts and dated lifecycle events exist.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    <div className="flex justify-end"><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh metrics</button></div>
    {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading persisted portfolio records…</p> : <>
      <section className="grid gap-3 md:grid-cols-3">
        <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Recorded opportunities</p><p className="mt-2 font-display text-4xl">{opportunities.length}</p></article>
        <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Prototype candidates</p><p className="mt-2 font-display text-4xl">{prototypes}</p></article>
        <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Product briefs</p><p className="mt-2 font-display text-4xl">{briefs}</p></article>
      </section>
      <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Financial contribution by currency</h2><p className="text-xs text-muted-ink">Verified event totals only · integer minor units</p></div>
        {summary.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No financial events recorded. Contribution is not available.</p> : <div className="grid gap-3 md:grid-cols-2">{summary.map((row) => <article key={row.currency} className="border border-acid-lime/20 bg-panel-charcoal p-4"><h3 className="font-display text-xl">{row.currency}</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-ink">Gross receipts</dt><dd className="font-mono">{row.gross_receipts_minor}</dd></div><div><dt className="text-muted-ink">Deductions</dt><dd className="font-mono">{row.deductions_minor}</dd></div><div><dt className="text-muted-ink">Net contribution</dt><dd className="font-mono text-acid-lime">{row.net_contribution_minor}</dd></div><div><dt className="text-muted-ink">Payout movements</dt><dd className="font-mono">{row.payout_movements_minor}</dd></div><div><dt className="text-muted-ink">Pending amount</dt><dd className="font-mono">{row.pending_minor}</dd></div><div><dt className="text-muted-ink">Pending events</dt><dd className="font-mono">{row.pending_count}</dd></div></dl></article>)}</div>}
      </section>
      <section className="grid gap-3 md:grid-cols-2"><article className="border border-dashed border-acid-lime/30 p-5"><h2 className="font-display text-xl uppercase">Discovery → opportunity</h2><p className="mt-2 text-sm text-muted-ink">Unavailable. Search impression and source-exposure events are not yet captured with a defined denominator.</p></article><article className="border border-dashed border-acid-lime/30 p-5"><h2 className="font-display text-xl uppercase">Product lifetime / cohort</h2><p className="mt-2 text-sm text-muted-ink">Unavailable. Publication, first-sale, retirement and cohort timestamps are not yet verified.</p></article></section>
    </>}
  </div></main>
}
