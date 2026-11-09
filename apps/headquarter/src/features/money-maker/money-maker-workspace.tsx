'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

type ScoreKey = 'demandEvidence' | 'competitionGap' | 'usefulnessDifferentiation' | 'marketplaceFit' | 'productionFeasibility' | 'durability' | 'distributionReadiness'
type GateKey = 'rights' | 'countryEligibility' | 'channelPolicy' | 'payoutFeasibility'
type Opportunity = {
  id: string
  title: string
  version: number
  buyerProblem: string
  buyerSegment: string
  jobToBeDone: string
  productHypothesis: string
  productFamily: string
  candidateChannels: string[]
  evidence: Array<{ evidenceId: string; sourceName: string; sourceUrl: string; summary: string }>
  scores: Partial<Record<ScoreKey, number>>
  scoreDetails: Partial<Record<ScoreKey, { rationale: string; confidence: 'high' | 'medium' | 'low' | 'unknown'; evidenceIds: string[] }>>
  hardGates: Record<GateKey, 'pass' | 'blocked' | 'unknown'>
  hardGateDetails: Record<GateKey, { status: 'pass' | 'blocked' | 'unknown'; rationale: string; evidenceIds: string[] }>
  evaluation: {
    score: number | null
    decision: string
    blockedGates: string[]
    unknownGates: string[]
    missingScoreDimensions: string[]
  }
}
type Product = { id: string; title?: string; name?: string; lifecycleState: string; version: number }
type Channel = { id: string; displayName: string; capability: string; channelStatus: string; accountEligibility: string; payoutSetupStatus: string }
type Listing = { id: string; productId: string; channelId: string; status: string; createdAt: string }
type Asset = { id: string; fileName: string; mediaType: string; byteSize: number; sha256: string }
type RecordItem = Record<string, unknown>
type WorkspaceData = {
  opportunities: Opportunity[]
  products: Product[]
  assets: Asset[]
  channels: Channel[]
  listings: Listing[]
  financialEvents: RecordItem[]
  payouts: RecordItem[]
  fxConversions: RecordItem[]
  financialSummary: unknown
  portfolioMetrics: unknown
}
type IntakeForm = {
  title: string
  buyerProblem: string
  buyerSegment: string
  jobToBeDone: string
  productHypothesis: string
  productFamily: string
  candidateChannels: string
  sourceName: string
  sourceUrl: string
  sourceType: string
  evidenceClass: string
  evidenceSummary: string
  reliability: string
  limitations: string
  collectionMethod: string
  permissionBasis: string
}

const emptyData: WorkspaceData = {
  opportunities: [], products: [], assets: [], channels: [], listings: [],
  financialEvents: [], payouts: [], fxConversions: [], financialSummary: null, portfolioMetrics: null,
}
const initialForm: IntakeForm = {
  title: '', buyerProblem: '', buyerSegment: '', jobToBeDone: '', productHypothesis: '',
  productFamily: 'digital-utility', candidateChannels: '',
  sourceName: '', sourceUrl: '', sourceType: 'official-documentation',
  evidenceClass: 'observed-fact', evidenceSummary: '', reliability: 'medium',
  limitations: '', collectionMethod: 'Manual review of the cited public source',
  permissionBasis: '',
}

async function readData<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`)
  return payload.data as T
}

function recordLabel(value: { title?: unknown; displayName?: unknown; name?: unknown; id?: unknown }): string {
  const candidate = value.title ?? value.displayName ?? value.name ?? value.id
  return typeof candidate === 'string' ? candidate : 'Untitled record'
}

export function MoneyMakerWorkspace() {
  const [data, setData] = useState<WorkspaceData>(emptyData)
  const [form, setForm] = useState<IntakeForm>(initialForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const metricsTo = new Date()
      const metricsFrom = new Date(metricsTo.getTime() - 30 * 24 * 60 * 60 * 1000)
      const metricsQuery = new URLSearchParams({ from: metricsFrom.toISOString(), to: metricsTo.toISOString() })
      const [opportunities, products, assets, channels, listings, financialEvents, payouts, fxConversions, financialSummary, portfolioMetrics] = await Promise.all([
        readData<Opportunity[]>('/api/money-maker/opportunities'),
        readData<Product[]>('/api/money-maker/products'),
        readData<Asset[]>('/api/money-maker/assets'),
        readData<Channel[]>('/api/money-maker/channels'),
        readData<Listing[]>('/api/money-maker/listings'),
        readData<RecordItem[]>('/api/money-maker/financial-events'),
        readData<RecordItem[]>('/api/money-maker/payouts'),
        readData<RecordItem[]>('/api/money-maker/fx-conversions'),
        readData<unknown>('/api/money-maker/financial-summary'),
        readData<unknown>(`/api/money-maker/portfolio-metrics?${metricsQuery.toString()}`),
      ])
      setData({ opportunities, products, assets, channels, listings, financialEvents, payouts, fxConversions, financialSummary, portfolioMetrics })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Money Maker records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  function updateField<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submitOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    const evidenceId = crypto.randomUUID()
    const now = new Date().toISOString()
    const gates = {
      rights: 'unknown',
      countryEligibility: 'unknown',
      channelPolicy: 'unknown',
      payoutFeasibility: 'unknown',
    } as const
    const payload = {
      title: form.title,
      buyerProblem: form.buyerProblem,
      buyerSegment: form.buyerSegment,
      jobToBeDone: form.jobToBeDone,
      productHypothesis: form.productHypothesis,
      productFamily: form.productFamily,
      candidateChannels: form.candidateChannels.split(',').map((value) => value.trim()).filter(Boolean),
      evidence: [{
        evidenceId,
        sourceName: form.sourceName,
        sourceUrl: form.sourceUrl,
        sourceType: form.sourceType,
        capturedAt: now,
        evidenceClass: form.evidenceClass,
        summary: form.evidenceSummary,
        reliability: form.reliability,
        limitations: form.limitations,
        collectionMethod: form.collectionMethod,
        permissionBasis: form.permissionBasis,
      }],
      // Intake starts unscored. The operator must add evidence-backed scores and pass every hard gate.
      scores: {},
      scoreDetails: {},
      hardGates: gates,
      hardGateDetails: Object.fromEntries(Object.entries(gates).map(([key, status]) => [key, {
        status,
        rationale: 'Not yet verified. An operator review with supporting evidence is required.',
        evidenceIds: [],
      }])),
    }

    try {
      const response = await fetch('/api/money-maker/opportunities', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error?.message ?? 'Opportunity intake failed.')
      setForm(initialForm)
      setNotice('Opportunity captured. It remains in research until scores and hard gates are supported by evidence.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Opportunity intake failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function archiveOpportunity(id: string) {
    if (!window.confirm('Archive this opportunity? The audit history will be retained.')) return
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/money-maker/opportunities/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error?.message ?? 'Unable to archive opportunity.')
      }
      setNotice('Opportunity archived. Its audit record is retained.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive opportunity.')
    }
  }

  const counts = [
    ['Opportunities', data.opportunities.length],
    ['Products', data.products.length],
    ['Assets', data.assets.length],
    ['Channels', data.channels.length],
    ['Listings', data.listings.length],
    ['Financial events', data.financialEvents.length],
    ['Payouts', data.payouts.length],
    ['FX conversions', data.fxConversions.length],
  ] as const

  return (
    <main className="min-h-screen space-y-8 p-6 text-foreground md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-3">
          <Badge variant="outline">Persisted ARSY records</Badge>
          <h1 className="font-display text-4xl uppercase tracking-tight md:text-5xl">Money Maker Workspace</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Evidence-led opportunity intake, product lifecycle, asset provenance, channel readiness,
            manual listing receipts and financial reconciliation. No marketplace publishing or bank payout is triggered here.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh records'}
        </button>
      </header>

      {error && <p role="alert" className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded border border-success/40 bg-success/10 p-3 text-sm">{notice}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity pipeline</CardTitle>
            <CardDescription>Live owner-scoped records. An intake record starts unscored and cannot be promoted until evidence and hard gates are complete.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.opportunities.length === 0 ? (
              <p className="rounded border border-dashed border-border p-6 text-sm text-muted-foreground">No persisted opportunities yet. Capture the first evidence-backed opportunity using the intake form.</p>
            ) : (
              <div className="space-y-3">
                {data.opportunities.map((item) => (
                  <article key={item.id} className="space-y-3 rounded border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <h3 className="font-semibold">{item.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">{item.evaluation.decision}</Badge>
                          <span className="text-muted-foreground">Version {item.version}</span>
                          <span className="text-muted-foreground">{item.evaluation.score === null ? 'Unscored' : `Score ${item.evaluation.score}/100`}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.evaluation.unknownGates.length} unknown gates · {item.evaluation.blockedGates.length} blocked gates · {item.evaluation.missingScoreDimensions.length} unscored dimensions
                        </p>
                      </div>
                      <button type="button" onClick={() => void archiveOpportunity(item.id)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">Archive</button>
                    </div>
                    <OpportunityReviewForm opportunity={item} onSaved={refresh} onError={setError} onNotice={setNotice} />
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capture opportunity</CardTitle>
            <CardDescription>Capture a source and a buyer problem first. Scoring and promotion remain blocked until separately reviewed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitOpportunity} className="space-y-3">
              <label className="block space-y-1 text-xs font-medium">Opportunity title
                <input required minLength={3} maxLength={180} value={form.title} onChange={(e) => updateField('title', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">Buyer problem
                <textarea required minLength={10} maxLength={3000} value={form.buyerProblem} onChange={(e) => updateField('buyerProblem', e.target.value)} className="min-h-20 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">Buyer segment
                <input required minLength={2} maxLength={300} value={form.buyerSegment} onChange={(e) => updateField('buyerSegment', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">Job to be done
                <textarea required minLength={5} maxLength={1000} value={form.jobToBeDone} onChange={(e) => updateField('jobToBeDone', e.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">Product hypothesis
                <textarea required minLength={5} maxLength={2000} value={form.productHypothesis} onChange={(e) => updateField('productHypothesis', e.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1 text-xs font-medium">Product family
                <select value={form.productFamily} onChange={(e) => updateField('productFamily', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
                  {['digital-utility', 'stock-asset', 'affiliate-media', 'publishing', 'workflow-product', 'media', 'game-asset', 'microgame'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-medium">Candidate channels (comma separated)
                <input value={form.candidateChannels} onChange={(e) => updateField('candidateChannels', e.target.value)} placeholder="Gumroad, Etsy" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
              </label>
              <div className="border-t border-border pt-3">
                <h3 className="mb-2 text-sm font-semibold">Source and evidence provenance</h3>
                <div className="space-y-3">
                  <label className="block space-y-1 text-xs font-medium">Source name
                    <input required value={form.sourceName} onChange={(e) => updateField('sourceName', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Source URL
                    <input required type="url" value={form.sourceUrl} onChange={(e) => updateField('sourceUrl', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Source type
                    <select value={form.sourceType} onChange={(e) => updateField('sourceType', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
                      {['official-marketplace', 'public-review', 'public-community', 'official-documentation', 'search-trend', 'github', 'other'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Evidence class
                    <select value={form.evidenceClass} onChange={(e) => updateField('evidenceClass', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
                      {['observed-fact', 'community-anecdote', 'inference', 'hypothesis', 'unknown'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Evidence summary
                    <textarea required minLength={1} maxLength={2000} value={form.evidenceSummary} onChange={(e) => updateField('evidenceSummary', e.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Reliability
                    <select value={form.reliability} onChange={(e) => updateField('reliability', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
                      {['high', 'medium', 'low', 'unknown'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Limitations
                    <textarea required minLength={1} maxLength={1000} value={form.limitations} onChange={(e) => updateField('limitations', e.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Collection method
                    <input required maxLength={300} value={form.collectionMethod} onChange={(e) => updateField('collectionMethod', e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">Permission basis
                    <input required maxLength={500} value={form.permissionBasis} onChange={(e) => updateField('permissionBasis', e.target.value)} placeholder="Why this source may be collected and retained" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full rounded bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? 'Saving…' : 'Save evidence-backed intake'}
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <RecordPanel title="Products" items={data.products} empty="No products promoted yet." />
        <RecordPanel title="Assets" items={data.assets} empty="No assets registered yet." />
        <RecordPanel title="Channels" items={data.channels} empty="No channel records yet." />
        <RecordPanel title="Listings" items={data.listings} empty="No manual listing packages yet." />
        <RecordPanel title="Payouts" items={data.payouts} empty="No payout records yet." />
        <RecordPanel title="FX conversions" items={data.fxConversions} empty="No FX conversion records yet." />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio analytics · rolling 30 days</CardTitle>
          <CardDescription>Window uses UTC and [from, to) semantics. Metrics without a verified event source are explicitly marked unavailable.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.portfolioMetrics, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial reconciliation</CardTitle>
          <CardDescription>Persisted financial events and summary; this workspace does not execute transfers or fetch FX quotes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.financialEvents.length} financial events recorded.</p>
          <pre className="max-h-72 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(data.financialSummary, null, 2)}</pre>
        </CardContent>
      </Card>
    </main>
  )
}

const scoreFields: Array<{ key: ScoreKey; label: string; max: number }> = [
  { key: 'demandEvidence', label: 'Demand evidence', max: 25 },
  { key: 'competitionGap', label: 'Competition gap', max: 20 },
  { key: 'usefulnessDifferentiation', label: 'Usefulness / differentiation', max: 15 },
  { key: 'marketplaceFit', label: 'Marketplace fit', max: 15 },
  { key: 'productionFeasibility', label: 'Production feasibility', max: 10 },
  { key: 'durability', label: 'Durability', max: 10 },
  { key: 'distributionReadiness', label: 'Distribution readiness', max: 5 },
]
const gateFields: Array<{ key: GateKey; label: string }> = [
  { key: 'rights', label: 'Rights' },
  { key: 'countryEligibility', label: 'Country eligibility' },
  { key: 'channelPolicy', label: 'Channel policy' },
  { key: 'payoutFeasibility', label: 'Payout feasibility' },
]

function OpportunityReviewForm({
  opportunity, onSaved, onError, onNotice,
}: {
  opportunity: Opportunity
  onSaved: () => Promise<void>
  onError: (value: string) => void
  onNotice: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [evidenceId, setEvidenceId] = useState(opportunity.evidence[0]?.evidenceId ?? '')
  const [scores, setScores] = useState<Record<ScoreKey, string>>(() => Object.fromEntries(scoreFields.map(({ key }) => [key, opportunity.scores[key] === undefined ? '' : String(opportunity.scores[key])])) as Record<ScoreKey, string>)
  const [scoreRationales, setScoreRationales] = useState<Record<ScoreKey, string>>(() => Object.fromEntries(scoreFields.map(({ key }) => [key, opportunity.scoreDetails[key]?.rationale ?? ''])) as Record<ScoreKey, string>)
  const [confidences, setConfidences] = useState<Record<ScoreKey, 'high' | 'medium' | 'low' | 'unknown'>>(() => Object.fromEntries(scoreFields.map(({ key }) => [key, opportunity.scoreDetails[key]?.confidence ?? 'unknown'])) as Record<ScoreKey, 'high' | 'medium' | 'low' | 'unknown'>)
  const [gates, setGates] = useState<Record<GateKey, 'pass' | 'blocked' | 'unknown'>>({ ...opportunity.hardGates })
  const [gateRationales, setGateRationales] = useState<Record<GateKey, string>>(() => Object.fromEntries(gateFields.map(({ key }) => [key, opportunity.hardGateDetails[key]?.rationale ?? 'Not yet verified; operator review required.'])) as Record<GateKey, string>)
  const [criteria, setCriteria] = useState('')

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!evidenceId) { onError('Select a supporting evidence record before saving a review.'); return }
    setSaving(true); onError(''); onNotice('')
    try {
      const nextScores: Partial<Record<ScoreKey, number>> = {}
      const nextScoreDetails: Opportunity['scoreDetails'] = {}
      for (const { key, max, label } of scoreFields) {
        const raw = scores[key].trim()
        if (!raw) continue
        const value = Number(raw)
        if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`${label} must be between 0 and ${max}.`)
        if (scoreRationales[key].trim().length < 10) throw new Error(`Add an evidence-based rationale (at least 10 characters) for ${label}.`)
        nextScores[key] = value
        nextScoreDetails[key] = { rationale: scoreRationales[key].trim(), confidence: confidences[key], evidenceIds: [evidenceId] }
      }
      const hardGateDetails = Object.fromEntries(gateFields.map(({ key }) => {
        const rationale = gateRationales[key].trim()
        if (rationale.length < 5) throw new Error(`Add a rationale for ${key}.`)
        return [key, { status: gates[key], rationale, evidenceIds: gates[key] === 'unknown' ? [] : [evidenceId] }]
      }))
      const input = {
        title: opportunity.title,
        buyerProblem: opportunity.buyerProblem,
        buyerSegment: opportunity.buyerSegment,
        jobToBeDone: opportunity.jobToBeDone,
        productHypothesis: opportunity.productHypothesis,
        productFamily: opportunity.productFamily,
        candidateChannels: opportunity.candidateChannels,
        evidence: opportunity.evidence,
        scores: nextScores,
        scoreDetails: nextScoreDetails,
        hardGates: gates,
        hardGateDetails,
      }
      const response = await fetch(`/api/money-maker/opportunities/${encodeURIComponent(opportunity.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: opportunity.version, input }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error?.message ?? 'Unable to save opportunity review.')
      onNotice('Evidence review saved. Promotion remains subject to the complete score and all hard gates.')
      setOpen(false)
      await onSaved()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to save opportunity review.')
    } finally { setSaving(false) }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const acceptanceCriteria = criteria.split('\n').map((value) => value.trim()).filter(Boolean)
    if (acceptanceCriteria.length === 0) { onError('Add at least one acceptance criterion before creating the product brief.'); return }
    setPromoting(true); onError(''); onNotice('')
    try {
      const response = await fetch('/api/money-maker/products/from-opportunity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ opportunityId: opportunity.id, acceptanceCriteria }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error?.message ?? 'Unable to create product brief.')
      onNotice('Product brief created from the reviewed opportunity snapshot.')
      await onSaved()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to create product brief.')
    } finally { setPromoting(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted">
          {open ? 'Close evidence review' : 'Review scores & hard gates'}
        </button>
        {opportunity.evaluation.decision === 'prototype-candidate' && (
          <form onSubmit={createProduct} className="flex min-w-0 flex-1 flex-wrap gap-2">
            <textarea required value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="Acceptance criteria, one per line" className="min-h-10 min-w-48 flex-1 rounded border border-input bg-background px-3 py-2 text-xs" />
            <button type="submit" disabled={promoting} className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{promoting ? 'Creating…' : 'Create product brief'}</button>
          </form>
        )}
      </div>
      {open && (
        <form onSubmit={saveReview} className="space-y-4 rounded border border-border bg-muted/20 p-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium">Evidence record used for this review</label>
            <select required value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-xs">
              {opportunity.evidence.map((item) => <option key={item.evidenceId} value={item.evidenceId}>{item.sourceName} · {item.evidenceId}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Only evidence already attached to this opportunity can support scores or non-unknown hard gates.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {scoreFields.map(({ key, label, max }) => (
              <div key={key} className="space-y-1 rounded border border-border p-2">
                <label className="block text-xs font-semibold">{label} (0–{max})
                  <input type="number" min="0" max={max} step="0.01" value={scores[key]} onChange={(event) => setScores((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
                </label>
                {scores[key] !== '' && <>
                  <textarea required minLength={10} value={scoreRationales[key]} onChange={(event) => setScoreRationales((current) => ({ ...current, [key]: event.target.value }))} placeholder="Why does the evidence justify this score?" className="min-h-16 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
                  <select value={confidences[key]} onChange={(event) => setConfidences((current) => ({ ...current, [key]: event.target.value as 'high' | 'medium' | 'low' | 'unknown' }))} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                    {['high', 'medium', 'low', 'unknown'].map((value) => <option key={value} value={value}>Confidence: {value}</option>)}
                  </select>
                </>}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Hard gates</h4>
            <div className="grid gap-3 md:grid-cols-2">
              {gateFields.map(({ key, label }) => (
                <div key={key} className="space-y-1 rounded border border-border p-2">
                  <label className="block text-xs font-semibold">{label}
                    <select value={gates[key]} onChange={(event) => setGates((current) => ({ ...current, [key]: event.target.value as 'pass' | 'blocked' | 'unknown' }))} className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-xs">
                      {['unknown', 'pass', 'blocked'].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <textarea required minLength={5} value={gateRationales[key]} onChange={(event) => setGateRationales((current) => ({ ...current, [key]: event.target.value }))} placeholder="Explain the gate status" className="min-h-14 w-full rounded border border-input bg-background px-2 py-1.5 text-xs" />
                </div>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving review…' : 'Save review with evidence references'}</button>
        </form>
      )}
    </div>
  )
}

function RecordPanel<T extends { id?: string; title?: unknown; displayName?: unknown; name?: unknown; status?: unknown; lifecycleState?: unknown }>({ title, items, empty }: { title: string; items: T[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
          <ul className="space-y-2">
            {items.slice(0, 8).map((item, index) => (
              <li key={typeof item.id === 'string' ? item.id : index} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0">
                <span className="min-w-0 truncate">{recordLabel(item)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{typeof item.status === 'string' ? item.status : typeof item.lifecycleState === 'string' ? item.lifecycleState : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
