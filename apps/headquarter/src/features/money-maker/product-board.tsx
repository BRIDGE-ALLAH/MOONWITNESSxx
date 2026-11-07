'use client'

import { OperatorLogoutButton } from './operator-logout-button'
import { useCallback, useEffect, useState } from 'react'

type Opportunity = {
  id: string
  title: string
  buyerProblem: string
  buyerSegment: string
  evaluation: { score: number | null; decision: string; blockedGates: string[]; unknownGates: string[]; missingScoreDimensions: string[] }
}
type Product = {
  id: string
  opportunityId: string | null
  title: string
  productFamily: string
  lifecycleState: 'brief' | 'production' | 'review' | 'ready' | 'listed' | 'retired'
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
}
type ProductVersion = {
  id: string
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
  createdAt: string
  createdBy: string
}

const lifecycleActions: Record<string, Array<{ state: 'production' | 'review' | 'retired'; label: string }>> = {
  brief: [{ state: 'production', label: 'Start production' }, { state: 'retired', label: 'Retire' }],
  production: [{ state: 'review', label: 'Send to review' }, { state: 'retired', label: 'Retire' }],
  review: [{ state: 'production', label: 'Return to production' }, { state: 'retired', label: 'Retire' }],
  retired: [],
}

export function ProductBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [criteria, setCriteria] = useState<Record<string, string>>({})
  const [versionDrafts, setVersionDrafts] = useState<Record<string, { summary: string; criteria: string }>>({})
  const [history, setHistory] = useState<Record<string, ProductVersion[]>>({})
  const [historyLoading, setHistoryLoading] = useState<string | null>(null)
  const [lifecycleRationales, setLifecycleRationales] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [opportunityResponse, productResponse] = await Promise.all([
        fetch('/api/opportunities?limit=100', { cache: 'no-store' }),
        fetch('/api/products?limit=100', { cache: 'no-store' }),
      ])
      const [opportunityPayload, productPayload] = await Promise.all([opportunityResponse.json(), productResponse.json()])
      if (opportunityResponse.status === 401 || productResponse.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!opportunityResponse.ok || !productResponse.ok) throw new Error(opportunityPayload.error?.message || productPayload.error?.message || 'Unable to load product workflow.')
      setOpportunities(opportunityPayload.data ?? [])
      setProducts(productPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product workflow.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createProduct(opportunityId: string) {
    const acceptanceCriteria = (criteria[opportunityId] || '').split('\n').map((line) => line.trim()).filter(Boolean)
    if (acceptanceCriteria.length === 0) {
      setError('Add at least one acceptance criterion before creating the product brief.')
      return
    }
    setSaving(opportunityId); setError(''); setMessage('')
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunityId, acceptanceCriteria }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to create product brief.')
      setMessage(`Product brief created: ${payload.data.title} · version ${payload.data.version}`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product brief.')
    } finally { setSaving('') }
  }

  async function loadHistory(productId: string) {
    setHistoryLoading(productId); setError('')
    try {
      const response = await fetch(`/api/products/${productId}/versions`, { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load product version history.')
      setHistory((current) => ({ ...current, [productId]: payload.data ?? [] }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product version history.')
    } finally { setHistoryLoading(null) }
  }

  async function createVersion(product: Product) {
    const draft = versionDrafts[product.id] ?? { summary: String(product.brief.summary ?? ''), criteria: product.acceptanceCriteria.join('\n') }
    const acceptanceCriteria = draft.criteria.split('\n').map((line) => line.trim()).filter(Boolean)
    if (acceptanceCriteria.length === 0) {
      setError('A product version needs at least one acceptance criterion.')
      return
    }
    setSaving(product.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/products/${product.id}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: product.version,
          brief: { ...product.brief, summary: draft.summary.trim() },
          acceptanceCriteria,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to create product version.')
      setMessage(`Created immutable version ${payload.data.version} for ${product.title}.`)
      await refresh()
      await loadHistory(product.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product version.')
    } finally { setSaving('') }
  }

  async function transition(product: Product, state: 'production' | 'review' | 'retired') {
    const rationale = (lifecycleRationales[product.id] ?? '').trim()
    if (rationale.length < 10) {
      setError('Add a lifecycle rationale of at least 10 characters before changing product state.')
      return
    }
    setSaving(product.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/products/${product.id}/lifecycle`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: product.version, state, rationale }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to change product lifecycle.')
      setLifecycleRationales((current) => ({ ...current, [product.id]: '' }))
      setMessage(`${product.title} moved to ${state}. Audit history recorded.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change product lifecycle.')
    } finally { setSaving('') }
  }

  const productOpportunityIds = new Set(products.map((product) => product.opportunityId).filter(Boolean))
  const ready = opportunities.filter((opportunity) =>
    opportunity.evaluation.decision === 'prototype-candidate' &&
    opportunity.evaluation.score !== null &&
    opportunity.evaluation.score >= 80 &&
    opportunity.evaluation.blockedGates.length === 0 &&
    opportunity.evaluation.unknownGates.length === 0 &&
    opportunity.evaluation.missingScoreDimensions.length === 0 &&
    !productOpportunityIds.has(opportunity.id),
  )

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><div className="mb-3 flex justify-end"><OperatorLogoutButton /></div><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Product Workshop</p><h1 className="mt-3 font-display text-5xl uppercase">THE FORGE</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Versioned product briefs with immutable history. Production, review and retirement are audited. Ready/listed states remain locked until asset inspections and channel receipts exist.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Product portfolio</h2><p className="text-xs text-muted-ink">Persisted products and append-only version records</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading product records…</p> : products.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No product briefs exist yet. Only fully cleared opportunities can enter production.</p> : <div className="grid gap-3 md:grid-cols-2">{products.map((product) => {
        const draft = versionDrafts[product.id] ?? { summary: String(product.brief.summary ?? ''), criteria: product.acceptanceCriteria.join('\n') }
        return <article key={product.id} className="space-y-4 border border-acid-lime/20 bg-panel-charcoal p-4">
          <div className="flex justify-between gap-3"><h3 className="font-display text-xl uppercase">{product.title}</h3><span className="font-mono text-xs text-acid-lime">v{product.version}</span></div>
          <p className="text-xs text-muted-ink">{product.productFamily} · {product.lifecycleState}</p>
          <ul className="list-disc pl-5 text-sm">{product.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
          <details className="border-t border-acid-lime/15 pt-3">
            <summary className="cursor-pointer font-mono text-xs uppercase text-acid-lime">Version history & edit brief</summary>
            <div className="mt-3 space-y-3">
              <button type="button" disabled={historyLoading === product.id} onClick={() => void loadHistory(product.id)} className="border border-acid-lime/30 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40">{historyLoading === product.id ? 'Loading history…' : 'Load immutable versions'}</button>
              {history[product.id]?.map((version) => <div key={version.id} className="border-l border-acid-lime/40 pl-3 text-xs"><p className="font-mono text-acid-lime">Version {version.version} · {new Date(version.createdAt).toLocaleString()}</p><p className="mt-1">{String(version.brief.summary ?? 'No summary recorded')}</p><p className="mt-1 text-muted-ink">Created by {version.createdBy}</p></div>)}
              {['brief', 'production', 'review'].includes(product.lifecycleState) && <>
                <label className="block space-y-1 text-[10px] font-mono uppercase text-muted-ink">Brief summary
                  <textarea value={draft.summary} onChange={(event) => setVersionDrafts((current) => ({ ...current, [product.id]: { ...draft, summary: event.target.value } }))} rows={2} maxLength={2000} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" />
                </label>
                <label className="block space-y-1 text-[10px] font-mono uppercase text-muted-ink">Acceptance criteria · one per line
                  <textarea value={draft.criteria} onChange={(event) => setVersionDrafts((current) => ({ ...current, [product.id]: { ...draft, criteria: event.target.value } }))} rows={3} maxLength={15000} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" />
                </label>
                <button type="button" disabled={saving === product.id} onClick={() => void createVersion(product)} className="bg-acid-lime px-4 py-2 font-mono text-[10px] font-bold uppercase text-obsidian disabled:opacity-40">{saving === product.id ? 'Saving version…' : `Create version ${product.version + 1}`}</button>
              </>}
            </div>
          </details>
          {lifecycleActions[product.lifecycleState]?.length > 0 && <div className="space-y-2 border-t border-acid-lime/15 pt-3">
            <label className="block space-y-1 text-[10px] font-mono uppercase text-muted-ink">Lifecycle rationale
              <textarea value={lifecycleRationales[product.id] ?? ''} onChange={(event) => setLifecycleRationales((current) => ({ ...current, [product.id]: event.target.value }))} rows={2} maxLength={1000} placeholder="Why is this transition justified?" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm normal-case" />
            </label>
            <div className="flex flex-wrap gap-2">{lifecycleActions[product.lifecycleState].map((action) => <button key={action.state} type="button" disabled={saving === product.id || (lifecycleRationales[product.id] ?? '').trim().length < 10} onClick={() => void transition(product, action.state)} className={action.state === 'retired' ? 'border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase text-red-300 disabled:opacity-40' : 'border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40'}>{action.label}</button>)}</div>
          </div>}
        </article>
      })}</div>}
    </section>
    <section className="space-y-4"><div><h2 className="font-display text-2xl uppercase">Ready for production</h2><p className="text-xs text-muted-ink">Prototype candidates with all hard gates passed and no product yet</p></div>
      {!loading && ready.length === 0 && <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No opportunities currently meet the production gate. Research more or resolve the missing evidence first.</p>}
      {ready.map((opportunity) => <article key={opportunity.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4"><div><h3 className="font-display text-xl uppercase">{opportunity.title}</h3><p className="mt-1 text-xs text-muted-ink">{opportunity.buyerSegment} · score {opportunity.evaluation.score}/100</p><p className="mt-3 text-sm">{opportunity.buyerProblem}</p></div><label className="block space-y-2 text-xs font-mono uppercase">Acceptance criteria<textarea aria-label={`Acceptance criteria for ${opportunity.title}`} value={criteria[opportunity.id] ?? ''} onChange={(event) => setCriteria((current) => ({ ...current, [opportunity.id]: event.target.value }))} rows={3} placeholder="One verifiable criterion per line" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label><button type="button" disabled={saving === opportunity.id} onClick={() => void createProduct(opportunity.id)} data-testid="create-product-brief" className="bg-acid-lime px-5 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving === opportunity.id ? 'Creating brief…' : 'Create version 1 product brief'}</button></article>)}
    </section>
  </div></main>
}
