'use client'

import { useCallback, useEffect, useState } from 'react'

type Summary = {
  currency: string
  gross_receipts_minor: string
  deductions_minor: string
  tax_reserve_minor: string
  payout_movements_minor: string
  pending_minor: string
  pending_count: string
  net_contribution_minor: string
}
type PortfolioMetrics = {
  window: { from: string; to: string; timezone: 'UTC'; semantics: '[from, to)' }
  opportunities: { createdCount: string; promotedCount: string; promotionRatePercent: string | null }
  products: {
    createdCount: string
    publishedCount: string
    firstSaleCount: string
    firstSaleRatePercent: string | null
    retiredCount: string
    averageCompletedLifetimeSeconds: string | null
  }
  unavailableMetrics: {
    discoveryToOpportunity: { available: false; reason: string }
    supportBurden: { available: false; reason: string }
  }
}

function localInput(daysAgo: number, includeCurrentMinute = false) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  // The API uses an end-exclusive [from, to) window. Round the default
  // "to" value up to the next minute so records created during this minute
  // are not silently excluded by the datetime-local minute precision.
  if (includeCurrentMinute) date.setMinutes(date.getMinutes() + 1, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function formatPercent(value: string | null) {
  return value === null ? 'Unavailable · no denominator' : `${value}%`
}
function formatLifetime(seconds: string | null) {
  if (seconds === null) return 'Unavailable · no completed retirement cohort'
  const days = Number(seconds) / 86_400
  return `${Number.isFinite(days) ? days.toFixed(2) : '—'} days`
}

export function AftershockBoard() {
  const [summary, setSummary] = useState<Summary[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [from, setFrom] = useState(() => localInput(30))
  const [to, setTo] = useState(() => localInput(0, true))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(to).toISOString()
      if (fromIso >= toIso) throw new Error('The end of the reporting window must be after its start.')
      const [metricsResponse, summaryResponse] = await Promise.all([
        fetch(`/api/portfolio-metrics?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, { cache: 'no-store' }),
        fetch('/api/financial-summary', { cache: 'no-store' }),
      ])
      const [metricsPayload, summaryPayload] = await Promise.all([metricsResponse.json(), summaryResponse.json()])
      if (metricsResponse.status === 401 || summaryResponse.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!metricsResponse.ok) throw new Error(metricsPayload.error?.message || 'Unable to load portfolio cohort metrics.')
      if (!summaryResponse.ok) throw new Error(summaryPayload.error?.message || 'Unable to load financial summaries.')
      setMetrics(metricsPayload.data)
      setSummary(summaryPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load portfolio performance.')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void refresh() }, [refresh])

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Portfolio Learning</p><h1 className="mt-3 font-display text-5xl uppercase">AFTERSHOCK</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Cohort metrics are computed in PostgreSQL from persisted opportunities, products, publication receipts, verified sales, and lifecycle audit events. The reporting window is UTC and end-exclusive. Currency summaries remain separate.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    <section className="flex flex-wrap items-end gap-3 border border-acid-lime/20 bg-panel-charcoal p-4">
      <label className="text-xs font-mono uppercase">From<input aria-label="Metrics from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
      <label className="text-xs font-mono uppercase">To<input aria-label="Metrics to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase disabled:opacity-50">{loading ? 'Loading…' : 'Refresh metrics'}</button>
      {metrics && <p className="text-[10px] text-muted-ink">UTC · [from, to) · {new Date(metrics.window.from).toLocaleString()} — {new Date(metrics.window.to).toLocaleString()}</p>}
    </section>
    {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading source-backed portfolio metrics…</p> : metrics && <>
      <section className="space-y-3">
        <div><h2 className="font-display text-2xl uppercase">Opportunity cohort</h2><p className="text-xs text-muted-ink">Denominator: non-archived opportunities created inside the selected window. Promotion is measured against linked product records as of now.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Opportunities created</p><p className="mt-2 font-display text-4xl">{metrics.opportunities.createdCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Promoted to product</p><p className="mt-2 font-display text-4xl">{metrics.opportunities.promotedCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Opportunity promotion rate</p><p className="mt-2 font-display text-3xl">{formatPercent(metrics.opportunities.promotionRatePercent)}</p></article>
        </div>
      </section>
      <section className="space-y-3">
        <div><h2 className="font-display text-2xl uppercase">Product cohort</h2><p className="text-xs text-muted-ink">Denominator: product briefs created inside the selected window. First sale requires a verified gross-receipt event linked to the product.</p></div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Products created</p><p className="mt-2 font-display text-4xl">{metrics.products.createdCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Published products</p><p className="mt-2 font-display text-4xl">{metrics.products.publishedCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Products with verified first sale</p><p className="mt-2 font-display text-4xl">{metrics.products.firstSaleCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">First-sale rate</p><p className="mt-2 font-display text-3xl">{formatPercent(metrics.products.firstSaleRatePercent)}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Retired products</p><p className="mt-2 font-display text-4xl">{metrics.products.retiredCount}</p></article>
          <article className="border border-acid-lime/20 bg-panel-charcoal p-5"><p className="text-xs font-mono uppercase text-muted-ink">Average completed lifetime</p><p className="mt-2 font-display text-2xl">{formatLifetime(metrics.products.averageCompletedLifetimeSeconds)}</p></article>
        </div>
      </section>
      <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Financial contribution by currency</h2><p className="text-xs text-muted-ink">Verified event totals only · integer minor units · no cross-currency aggregation</p></div>
        {summary.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No financial events recorded. Contribution is not available.</p> : <div className="grid gap-3 md:grid-cols-2">{summary.map((row) => <article key={row.currency} className="border border-acid-lime/20 bg-panel-charcoal p-4"><h3 className="font-display text-xl">{row.currency}</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-ink">Gross receipts</dt><dd className="font-mono">{row.gross_receipts_minor}</dd></div><div><dt className="text-muted-ink">Deductions</dt><dd className="font-mono">{row.deductions_minor}</dd></div><div><dt className="text-muted-ink">Net contribution · before tax reserve and payouts</dt><dd className="font-mono text-acid-lime">{row.net_contribution_minor}</dd></div><div><dt className="text-muted-ink">Tax reserve · verified</dt><dd className="font-mono">{row.tax_reserve_minor}</dd></div><div><dt className="text-muted-ink">Payout movements</dt><dd className="font-mono">{row.payout_movements_minor}</dd></div><div><dt className="text-muted-ink">Pending events</dt><dd className="font-mono">{row.pending_count} · {row.pending_minor}</dd></div></dl></article>)}</div>}
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <article className="border border-dashed border-acid-lime/30 p-5"><h2 className="font-display text-xl uppercase">Discovery → opportunity</h2><p className="mt-2 text-sm text-muted-ink">Unavailable. {metrics.unavailableMetrics.discoveryToOpportunity.reason}</p></article>
        <article className="border border-dashed border-acid-lime/30 p-5"><h2 className="font-display text-xl uppercase">Support burden</h2><p className="mt-2 text-sm text-muted-ink">Unavailable. {metrics.unavailableMetrics.supportBurden.reason}</p></article>
      </section>
    </>}
  </div></main>
}
