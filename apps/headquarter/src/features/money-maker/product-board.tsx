'use client'

import { OperatorLogoutButton } from './operator-logout-button'
import { useCallback, useEffect, useState } from 'react'

type Opportunity = {
  id: string
  title: string
  buyerProblem: string
  buyerSegment: string
  evaluation: { score: number | null; decision: string; blockedGates: string[]; unknownGates: string[] }
}
type Product = { id: string; opportunityId: string | null; title: string; productFamily: string; lifecycleState: string; allowedNextLifecycleStates: string[]; version: number; versionId: string; brief: Record<string, unknown>; acceptanceCriteria: string[] }
type ProductVersion = { id: string; version: number; brief: Record<string, unknown>; acceptanceCriteria: string[]; createdAt: string; createdBy: string }

export function ProductBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [criteria, setCriteria] = useState<Record<string, string>>({})
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})
  const [versionHistory, setVersionHistory] = useState<Record<string, ProductVersion[]>>({})
  const [loadingHistory, setLoadingHistory] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [updatingLifecycle, setUpdatingLifecycle] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [opportunityResponse, productResponse] = await Promise.all([
        fetch('/api/opportunities', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
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

  async function createVersion(product: Product) {
    const notes = (revisionNotes[product.id] ?? '').trim()
    if (notes.length < 10) {
      setError('Add at least 10 characters of revision notes before creating a new version.')
      return
    }
    setSaving(product.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/products/${product.id}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: product.version,
          brief: { ...product.brief, revisionNotes: notes, previousVersion: product.version },
          acceptanceCriteria: product.acceptanceCriteria,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to create product revision.')
      setRevisionNotes((current) => ({ ...current, [product.id]: '' }))
      setMessage(`New immutable product version created: v${payload.data.version}. Previous versions remain available.`)
      await refresh()
      await loadVersionHistory(product.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product revision.')
    } finally { setSaving('') }
  }

  async function loadVersionHistory(productId: string) {
    setLoadingHistory(productId); setError('')
    try {
      const response = await fetch(`/api/products/${productId}/versions`, { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load product version history.')
      setVersionHistory((current) => ({ ...current, [productId]: payload.data ?? [] }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product version history.')
    } finally { setLoadingHistory('') }
  }

  async function transitionProduct(productId: string, lifecycleState: string) {
    setUpdatingLifecycle(productId); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/products/${productId}/lifecycle`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lifecycleState }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to update product lifecycle.')
      setMessage(`Product lifecycle updated: ${payload.data.title} · ${payload.data.lifecycleState}`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update product lifecycle.')
    } finally { setUpdatingLifecycle('') }
  }

  const productOpportunityIds = new Set(products.map((product) => product.opportunityId).filter(Boolean))
  const ready = opportunities.filter((opportunity) =>
    opportunity.evaluation.decision === 'prototype-candidate' &&
    opportunity.evaluation.score !== null &&
    opportunity.evaluation.score >= 80 &&
    opportunity.evaluation.blockedGates.length === 0 &&
    opportunity.evaluation.unknownGates.length === 0 &&
    !productOpportunityIds.has(opportunity.id),
  )

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><div className="mb-3 flex justify-end"><OperatorLogoutButton /></div><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Product Workshop</p><h1 className="mt-3 font-display text-5xl uppercase">THE FORGE</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Turn only approved, evidence-backed opportunities into versioned product briefs. A brief is not a published product and does not imply a sale.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Product portfolio</h2><p className="text-xs text-muted-ink">Persisted products and version records</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading product records…</p> : products.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No product briefs exist yet. Only fully cleared opportunities can enter production.</p> : <div className="grid gap-3 md:grid-cols-2">{products.map((product) => <article key={product.id} className="border border-acid-lime/20 bg-panel-charcoal p-4"><div className="flex justify-between gap-3"><h3 className="font-display text-xl uppercase">{product.title}</h3><span className="font-mono text-xs text-acid-lime">v{product.version}</span></div><p className="mt-2 text-xs text-muted-ink">{product.productFamily} · {product.lifecycleState}</p><label className="mt-3 flex items-center gap-3 text-xs font-mono uppercase text-muted-ink">Lifecycle<select aria-label={`Lifecycle state for ${product.title}`} value={product.lifecycleState} disabled={updatingLifecycle === product.id || product.allowedNextLifecycleStates.length === 0} onChange={(event) => void transitionProduct(product.id, event.target.value)} className="border border-acid-lime/30 bg-obsidian px-3 py-2 text-paper-bone disabled:opacity-50"><option value={product.lifecycleState}>{product.lifecycleState}</option>{product.allowedNextLifecycleStates.map((state) => <option key={state} value={state}>{state}</option>)}</select></label><ul className="mt-3 list-disc pl-5 text-sm">{product.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul><details className="mt-4 border-t border-acid-lime/20 pt-3"><summary className="cursor-pointer font-mono text-xs uppercase">Create next version</summary><textarea value={revisionNotes[product.id] ?? ''} onChange={(event) => setRevisionNotes((current) => ({ ...current, [product.id]: event.target.value }))} rows={2} placeholder="Describe what changes in this revision" className="mt-3 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /><button type="button" disabled={saving === product.id} onClick={() => void createVersion(product)} className="mt-2 border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase disabled:opacity-50">{saving === product.id ? 'Creating…' : `Create v${product.version + 1}`}</button></details><div className="mt-3 space-y-2"><button type="button" data-testid={`load-product-history-${product.id}`} disabled={loadingHistory === product.id} onClick={() => void loadVersionHistory(product.id)} className="border border-acid-lime/30 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-50">{loadingHistory === product.id ? 'Loading history…' : `Load version history for ${product.title}`}</button>{versionHistory[product.id] && <ol className="space-y-2 text-xs text-muted-ink">{versionHistory[product.id].map((version) => <li key={version.id} className="border-l border-acid-lime/40 pl-3"><strong className="text-paper-bone">Version {version.version}</strong> · {new Date(version.createdAt).toLocaleString()} · {version.createdBy} · {version.acceptanceCriteria.length} acceptance criteria</li>)}</ol>}</div><AssetManager productVersionId={product.versionId} /></article>)}</div>}
    </section>
    <section className="space-y-4"><div><h2 className="font-display text-2xl uppercase">Ready for production</h2><p className="text-xs text-muted-ink">Prototype candidates with all hard gates passed and no product yet</p></div>
      {!loading && ready.length === 0 && <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No opportunities currently meet the production gate. Research more or resolve the missing evidence first.</p>}
      {ready.map((opportunity) => <article key={opportunity.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4"><div><h3 className="font-display text-xl uppercase">{opportunity.title}</h3><p className="mt-1 text-xs text-muted-ink">{opportunity.buyerSegment} · score {opportunity.evaluation.score}/100</p><p className="mt-3 text-sm">{opportunity.buyerProblem}</p></div><label className="block space-y-2 text-xs font-mono uppercase">Acceptance criteria<textarea value={criteria[opportunity.id] ?? ''} onChange={(event) => setCriteria((current) => ({ ...current, [opportunity.id]: event.target.value }))} rows={3} placeholder="One verifiable criterion per line" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label><button type="button" disabled={saving === opportunity.id} onClick={() => void createProduct(opportunity.id)} className="bg-acid-lime px-5 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving === opportunity.id ? 'Creating brief…' : 'Create version 1 product brief'}</button></article>)}
    </section>
  </div></main>
}
