'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Product = { id: string; title: string; versionId: string; version: number; lifecycleState: string }
type Inspection = { id: string; productVersionId: string; inspectionType: string; status: string; findings: Array<{ description: string; severity: string; evidenceUrl?: string }>; inspectedAt: string; productReady: boolean }
const types = [['rights', 'Rights & licensing'], ['policy', 'Marketplace policy'], ['technical', 'Technical QA'], ['creative', 'Creative QA']] as const

export function ZillWatchBoard() {
  const [products, setProducts] = useState<Product[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [productResponse, inspectionResponse] = await Promise.all([
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/inspections', { cache: 'no-store' }),
      ])
      const [productPayload, inspectionPayload] = await Promise.all([productResponse.json(), inspectionResponse.json()])
      if (productResponse.status === 401 || inspectionResponse.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!productResponse.ok || !inspectionResponse.ok) throw new Error(productPayload.error?.message || inspectionPayload.error?.message || 'Unable to load inspections.')
      setProducts(productPayload.data ?? [])
      setInspections(inspectionPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load inspections.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function recordInspection(event: FormEvent<HTMLFormElement>, product: Product) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const type = String(data.get('inspectionType') || 'rights')
    const status = String(data.get('status') || 'needs-review')
    const description = String(data.get('description') || '')
    const evidenceUrl = String(data.get('evidenceUrl') || '')
    if ((type === 'rights' || type === 'policy') && status === 'pass' && !evidenceUrl) {
      setError('Rights and policy checks cannot pass without a source evidence URL.')
      return
    }
    setSaving(product.id); setError(''); setMessage('')
    try {
      const response = await fetch('/api/inspections', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productVersionId: product.versionId,
          inspectionType: type,
          status,
          findings: [{ severity: status === 'blocked' ? 'blocker' : status === 'warning' ? 'warning' : 'info', description, ...(evidenceUrl ? { evidenceUrl } : {}) }],
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to save inspection.')
      form.reset()
      setMessage(payload.data.productReady ? 'All four latest inspections pass and every active asset has cleared rights. Product lifecycle is READY.' : 'Inspection recorded. Product remains in REVIEW until all four latest inspections pass and every active asset has cleared rights.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save inspection.')
    } finally { setSaving('') }
  }

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Quality & Integrity</p><h1 className="mt-3 font-display text-5xl uppercase">ZILL WATCH</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Append-only rights, policy, technical and creative inspections. A product becomes READY only when all four latest inspections pass and at least one active asset exists with every active asset marked rights-cleared.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading product versions and inspection history…</p> : products.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No product versions are available for inspection. Create a product brief in THE FORGE first.</p> : products.map((product) => {
      const current = inspections.filter((item) => item.productVersionId === product.versionId)
      const latest = new Map<string, Inspection>()
      for (const item of current) if (!latest.has(item.inspectionType)) latest.set(item.inspectionType, item)
      return <article key={product.id} className="space-y-4 border border-acid-lime/20 bg-panel-charcoal p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl uppercase">{product.title}</h2><p className="text-xs text-muted-ink">Version {product.version} · {product.lifecycleState}</p></div><span className="font-mono text-xs text-acid-lime">{types.filter(([type]) => latest.get(type)?.status === 'pass').length}/4 PASSED</span></div>
        <div className="grid gap-2 md:grid-cols-4">{types.map(([type, label]) => { const record = latest.get(type); return <div key={type} className="border border-acid-lime/15 p-3"><p className="text-xs font-mono uppercase">{label}</p><p className="mt-2 text-sm">{record?.status ?? 'not reviewed'}</p>{record?.findings?.[0] && <p className="mt-1 text-[10px] text-muted-ink">{record.findings[0].description}</p>}</div> })}</div>
        <form onSubmit={(event) => void recordInspection(event, product)} className="grid gap-3 border-t border-acid-lime/15 pt-4 md:grid-cols-2">
          <label className="space-y-1 text-xs font-mono uppercase">Inspection type<select name="inspectionType" defaultValue="rights" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{types.map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <label className="space-y-1 text-xs font-mono uppercase">Result<select name="status" defaultValue="needs-review" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="needs-review">Needs review</option><option value="pass">Pass</option><option value="warning">Warning</option><option value="blocked">Blocked</option></select></label>
          <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Finding / rationale<textarea name="description" required minLength={5} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
          <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Evidence URL (required for rights/policy pass)<input name="evidenceUrl" type="url" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
          <button disabled={saving === product.id} className="border border-acid-lime px-4 py-2 font-mono text-xs uppercase disabled:opacity-50 md:col-span-2">{saving === product.id ? 'Recording…' : 'Record append-only inspection'}</button>
        </form>
      </article>
    })}
  </div></main>
}
