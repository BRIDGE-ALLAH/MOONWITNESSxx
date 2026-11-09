'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@riotworks/ui'

export type ProductRecord = {
  id: string
  title: string
  productFamily: string
  lifecycleState: 'brief' | 'production' | 'review' | 'ready' | 'listed' | 'retired'
  allowedNextLifecycleStates: Array<'brief' | 'production' | 'review' | 'ready' | 'listed' | 'retired'>
  version: number
  versionId: string
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
  createdAt: string
  updatedAt: string
}

type ProductVersion = {
  id: string
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
  createdAt: string
  createdBy: string
}

async function readPayload<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload.error?.message === 'string' ? payload.error.message : `Request failed (${response.status})`
    throw Object.assign(new Error(message), { status: response.status })
  }
  return payload.data as T
}

export function ProductRecordPanel({ products, onSaved }: {
  products: ProductRecord[]
  onSaved: () => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Products</CardTitle>
        <CardDescription>Immutable version snapshots and lifecycle actions backed by ARSY. Lifecycle choices come from the domain service.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products promoted yet.</p>
        ) : products.map((product) => (
          <ProductRecordEditor key={product.id} product={product} onSaved={onSaved} />
        ))}
      </CardContent>
    </Card>
  )
}

function ProductRecordEditor({ product, onSaved }: {
  product: ProductRecord
  onSaved: () => Promise<void>
}) {
  const [briefDraft, setBriefDraft] = useState(() => JSON.stringify(product.brief, null, 2))
  const [criteriaDraft, setCriteriaDraft] = useState(() => product.acceptanceCriteria.join('\n'))
  const [history, setHistory] = useState<ProductVersion[] | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [changingLifecycle, setChangingLifecycle] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setBriefDraft(JSON.stringify(product.brief, null, 2))
    setCriteriaDraft(product.acceptanceCriteria.join('\n'))
  }, [product.version, product.versionId, product.brief, product.acceptanceCriteria])

  async function loadHistory() {
    setError('')
    try {
      const response = await fetch(`/api/money-maker/products/${encodeURIComponent(product.id)}/versions`, { cache: 'no-store' })
      const versions = await readPayload<ProductVersion[]>(response)
      setHistory(versions)
      setHistoryOpen(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product version history.')
    }
  }

  async function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingVersion(true)
    setError('')
    setNotice('')
    let brief: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(briefDraft)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Product brief must be a JSON object.')
      }
      brief = parsed as Record<string, unknown>
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Product brief JSON is invalid.')
      setSavingVersion(false)
      return
    }
    const acceptanceCriteria = criteriaDraft.split('\n').map((value) => value.trim()).filter(Boolean)
    if (acceptanceCriteria.length === 0 || acceptanceCriteria.some((value) => value.length < 3)) {
      setError('Add at least one acceptance criterion with three or more characters.')
      setSavingVersion(false)
      return
    }

    try {
      const response = await fetch(`/api/money-maker/products/${encodeURIComponent(product.id)}/versions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: product.version, brief, acceptanceCriteria }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          setError('Version conflict: this product changed after it was loaded. The latest persisted version has been refreshed; review it before saving again.')
          await onSaved()
          return
        }
        throw new Error(result.error?.message ?? 'Unable to create product version.')
      }
      setNotice(`Version ${result.data.version} saved. Previous versions remain immutable.`)
      setHistory(null)
      await onSaved()
      await loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create product version.')
    } finally {
      setSavingVersion(false)
    }
  }

  async function transitionLifecycle(nextState: ProductRecord['lifecycleState']) {
    setChangingLifecycle(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/money-maker/products/${encodeURIComponent(product.id)}/lifecycle`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lifecycleState: nextState }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          setError('Lifecycle conflict: ARSY rejected this transition because the product state changed or the transition is not allowed. The latest state has been refreshed.')
          await onSaved()
          return
        }
        throw new Error(result.error?.message ?? 'Unable to change product lifecycle.')
      }
      setNotice(`Product moved to ${result.data.lifecycleState}.`)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change product lifecycle.')
    } finally {
      setChangingLifecycle(false)
    }
  }

  const canCreateVersion = ['brief', 'production', 'review', 'ready'].includes(product.lifecycleState)

  return (
    <article className="space-y-3 rounded border border-border p-4" aria-label={`Product ${product.title}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold">{product.title}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">{product.lifecycleState}</Badge>
            <span className="text-muted-foreground">Version {product.version}</span>
            <span className="text-muted-foreground">{product.productFamily}</span>
          </div>
          <p className="break-all text-xs text-muted-foreground">Immutable version ID: {product.versionId}</p>
        </div>
        <button type="button" onClick={() => void (historyOpen ? setHistoryOpen(false) : loadHistory())} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">
          {historyOpen ? 'Hide version history' : 'View version history'}
        </button>
      </div>

      <div className="rounded bg-muted/40 p-3">
        <h4 className="mb-2 text-xs font-semibold">Current immutable brief · version {product.version}</h4>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(product.brief, null, 2)}</pre>
        <p className="mt-2 text-xs font-medium">Acceptance criteria</p>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {product.acceptanceCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}
        </ul>
      </div>

      {historyOpen && history && (
        <section className="space-y-2 rounded border border-border p-3" aria-label="Product version history">
          <h4 className="text-xs font-semibold">Version history</h4>
          {history.map((version) => (
            <div key={version.id} className="border-b border-border pb-2 text-xs last:border-0">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>Version {version.version}</strong>
                <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 text-muted-foreground">Created by {version.createdBy}</p>
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(version.brief, null, 2)}</pre>
              <ul className="mt-1 list-disc pl-5">{version.acceptanceCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>
            </div>
          ))}
        </section>
      )}

      {canCreateVersion ? (
        <form onSubmit={createVersion} className="space-y-2 rounded border border-border p-3">
          <h4 className="text-xs font-semibold">Create next immutable version</h4>
          <p className="text-xs text-muted-foreground">Saving uses expected version {product.version}. A concurrent edit is rejected rather than overwriting a newer version.</p>
          <label className="block space-y-1 text-xs font-medium">Product brief JSON
            <textarea aria-label="Product brief JSON" required value={briefDraft} onChange={(event) => setBriefDraft(event.target.value)} className="min-h-28 w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block space-y-1 text-xs font-medium">Acceptance criteria (one per line)
            <textarea aria-label="Acceptance criteria (one per line)" required value={criteriaDraft} onChange={(event) => setCriteriaDraft(event.target.value)} className="min-h-20 w-full rounded border border-input bg-background px-3 py-2 text-xs" />
          </label>
          <button type="submit" disabled={savingVersion} className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {savingVersion ? 'Saving version…' : 'Create version'}
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Version editing is unavailable while this product is {product.lifecycleState}.</p>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold">Allowed lifecycle actions</h4>
        {product.allowedNextLifecycleStates.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {product.allowedNextLifecycleStates.map((nextState) => (
              <button key={nextState} type="button" disabled={changingLifecycle} onClick={() => void transitionLifecycle(nextState)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50">
                {changingLifecycle ? 'Updating…' : `Move to ${nextState}`}
              </button>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">No lifecycle transitions are allowed from {product.lifecycleState}.</p>}
        <p className="text-xs text-muted-foreground">Ready is derived from completed inspections; listed is derived from a verified publication receipt. Neither state can be selected manually. Retired products are terminal.</p>
      </div>

      {error && <p role="alert" className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs">{error}</p>}
      {notice && <p role="status" className="rounded border border-success/40 bg-success/10 p-2 text-xs">{notice}</p>}
    </article>
  )
}
