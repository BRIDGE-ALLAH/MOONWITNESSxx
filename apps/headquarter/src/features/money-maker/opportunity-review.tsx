'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { OperatorLogoutButton } from './operator-logout-button'

type Evidence = {
  evidenceId: string; sourceName: string; sourceUrl: string
  sourceType: 'official-marketplace' | 'public-review' | 'public-community' | 'official-documentation' | 'search-trend' | 'github' | 'other'
  capturedAt: string; publishedAt?: string | null
  evidenceClass: 'observed-fact' | 'community-anecdote' | 'inference' | 'hypothesis' | 'unknown'
  summary: string; reliability: 'high' | 'medium' | 'low' | 'unknown'
  limitations: string; collectionMethod: string; permissionBasis: string
  recheckAt?: string | null
}
type Dimension = 'demandEvidence' | 'competitionGap' | 'usefulnessDifferentiation' | 'marketplaceFit' | 'productionFeasibility' | 'durability' | 'distributionReadiness'
type Gate = 'rights' | 'countryEligibility' | 'channelPolicy' | 'payoutFeasibility'
type Confidence = 'high' | 'medium' | 'low' | 'unknown'
type GateStatus = 'pass' | 'blocked' | 'unknown'
type DimensionDetail = { rationale: string; confidence: Confidence; evidenceIds: string[] }
type GateDetail = { status: GateStatus; rationale: string; evidenceIds: string[] }
type OpportunityInput = {
  title: string; buyerProblem: string; buyerSegment: string; jobToBeDone: string
  productHypothesis: string; productFamily: string; candidateChannels: string[]
  evidence: Evidence[]; scores: Partial<Record<Dimension, number>>
  scoreDetails: Partial<Record<Dimension, DimensionDetail>>
  hardGates: Record<Gate, GateStatus>; hardGateDetails: Record<Gate, GateDetail>
}
type Opportunity = OpportunityInput & {
  id: string; revision: number
  evaluation: { score: number | null; decision: string; blockedGates: string[]; unknownGates: string[]; missingScoreDimensions: string[] }
  decisionRationale: string | null; createdAt: string; updatedAt: string
}
type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string }; current?: Opportunity }
const dimensions: { key: Dimension; label: string; max: number }[] = [
  { key: 'demandEvidence', label: 'Demand evidence', max: 25 },
  { key: 'competitionGap', label: 'Competition / quality gap', max: 20 },
  { key: 'usefulnessDifferentiation', label: 'Usefulness / differentiation', max: 15 },
  { key: 'marketplaceFit', label: 'Marketplace / buyer-intent fit', max: 15 },
  { key: 'productionFeasibility', label: 'Production feasibility', max: 10 },
  { key: 'durability', label: 'Durability / repeat demand', max: 10 },
  { key: 'distributionReadiness', label: 'Distribution readiness', max: 5 },
]
const gates: { key: Gate; label: string }[] = [
  { key: 'rights', label: 'Rights & licensing' },
  { key: 'countryEligibility', label: 'Country eligibility' },
  { key: 'channelPolicy', label: 'Channel policy' },
  { key: 'payoutFeasibility', label: 'Payout feasibility' },
]
const evidenceTypes = ['official-marketplace', 'public-review', 'public-community', 'official-documentation', 'search-trend', 'github', 'other'] as const
const evidenceClasses = ['observed-fact', 'community-anecdote', 'inference', 'hypothesis', 'unknown'] as const
const confidences = ['high', 'medium', 'low', 'unknown'] as const
const gateStatuses = ['pass', 'blocked', 'unknown'] as const

function makeDraft(record: Opportunity): OpportunityInput {
  return {
    title: record.title,
    buyerProblem: record.buyerProblem,
    buyerSegment: record.buyerSegment,
    jobToBeDone: record.jobToBeDone,
    productHypothesis: record.productHypothesis,
    productFamily: record.productFamily,
    candidateChannels: [...record.candidateChannels],
    evidence: record.evidence.map((item) => ({ ...item })),
    scores: { ...record.scores },
    scoreDetails: Object.fromEntries(Object.entries(record.scoreDetails).map(([key, value]) => [key, value ? { ...value, evidenceIds: [...value.evidenceIds] } : value])),
    hardGates: { ...record.hardGates },
    hardGateDetails: Object.fromEntries(Object.entries(record.hardGateDetails).map(([key, value]) => [key, { ...value, evidenceIds: [...value.evidenceIds] }])) as Record<Gate, GateDetail>,
  }
}

export function OpportunityReview({ opportunityId }: { opportunityId: string }) {
  const [record, setRecord] = useState<Opportunity | null>(null)
  const [draft, setDraft] = useState<OpportunityInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [staleRecord, setStaleRecord] = useState<Opportunity | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/opportunities/' + opportunityId, { cache: 'no-store' })
      const payload = await response.json() as ApiPayload<Opportunity>
      if (response.status === 401) throw new Error('Operator login required. Sign in again.')
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || 'Unable to load this opportunity.')
      setRecord(payload.data)
      setDraft(makeDraft(payload.data))
      setStaleRecord(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this opportunity.')
    } finally { setLoading(false) }
  }, [opportunityId])

  useEffect(() => { void refresh() }, [refresh])

  function patch<K extends keyof OpportunityInput>(key: K, value: OpportunityInput[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  function patchEvidence(index: number, key: keyof Evidence, value: string) {
    setDraft((current) => current ? {
      ...current,
      evidence: current.evidence.map((item, position) => position === index ? { ...item, [key]: value } as Evidence : item),
    } : current)
  }

  function patchDimension(key: Dimension, field: 'score' | 'rationale' | 'confidence' | 'evidenceIds', value: string) {
    setDraft((current) => {
      if (!current) return current
      const scores = { ...current.scores }
      const scoreDetails = { ...current.scoreDetails }
      if (field === 'score') {
        if (value === '') delete scores[key]
        else scores[key] = Number(value)
      } else {
        const previous = scoreDetails[key] ?? { rationale: '', confidence: 'unknown' as Confidence, evidenceIds: [] }
        scoreDetails[key] = {
          ...previous,
          ...(field === 'rationale' ? { rationale: value } : {}),
          ...(field === 'confidence' ? { confidence: value as Confidence } : {}),
          ...(field === 'evidenceIds' ? { evidenceIds: value.split(',').map((item) => item.trim()).filter(Boolean) } : {}),
        }
      }
      return { ...current, scores, scoreDetails }
    })
  }

  function patchGate(key: Gate, field: 'status' | 'rationale' | 'evidenceIds', value: string) {
    setDraft((current) => {
      if (!current) return current
      const status = field === 'status' ? value as GateStatus : current.hardGates[key]
      const previous = current.hardGateDetails[key]
      return {
        ...current,
        hardGates: { ...current.hardGates, [key]: status },
        hardGateDetails: {
          ...current.hardGateDetails,
          [key]: {
            ...previous,
            status,
            ...(field === 'rationale' ? { rationale: value } : {}),
            ...(field === 'evidenceIds' ? { evidenceIds: value.split(',').map((item) => item.trim()).filter(Boolean) } : {}),
          },
        },
      }
    })
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || !record) return
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/opportunities/' + opportunityId, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: record.revision, input: draft }),
      })
      const payload = await response.json() as ApiPayload<Opportunity>
      if (response.status === 401) throw new Error('Operator login required. Sign in again.')
      if (response.status === 409 && payload.error?.code === 'STALE_WRITE') {
        setStaleRecord(payload.current ?? null)
        setError('This record changed after you opened it. Your draft has not been saved. Reload the latest version before editing again.')
        return
      }
      if (response.status === 409 && payload.error?.code === 'OPPORTUNITY_VERSION_LOCKED') {
        setError('This opportunity has already been promoted. Its product brief is a versioned snapshot; use The Forge product-version workflow for future changes.')
        await refresh()
        return
      }
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || 'Unable to save opportunity changes.')
      setRecord(payload.data); setDraft(makeDraft(payload.data)); setStaleRecord(null)
      setMessage('Saved revision ' + payload.data.revision + '. Every content update is recorded in the audit trail.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save opportunity changes.')
    } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-obsidian p-8 text-paper-bone"><p role="status">Loading opportunity evidence…</p></main>
  if (!record || !draft) return <main className="min-h-screen bg-obsidian p-8 text-paper-bone"><div role="alert" className="border border-red-500/50 p-5">{error || 'Opportunity not found.'}</div><Link href="/riot-radar" className="mt-4 inline-block text-acid-lime underline">Back to RIOT RADAR</Link></main>

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8">
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-acid-lime/30 pb-6">
        <div><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Evidence review</p><h1 className="mt-3 font-display text-4xl uppercase">Opportunity review</h1><p className="mt-2 text-sm text-muted-ink">{record.title} · revision {record.revision} · {record.evaluation.decision}</p></div>
        <div className="flex items-center gap-3"><Link href="/riot-radar" className="border border-acid-lime/30 px-3 py-2 font-mono text-xs uppercase">Back to register</Link><OperatorLogoutButton /></div>
      </header>

      {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}{staleRecord && <button type="button" onClick={() => void refresh()} className="ml-3 underline">Reload current revision</button>}</div>}
      {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}

      <section className="grid gap-3 md:grid-cols-3">
        <article className="border border-acid-lime/20 bg-panel-charcoal p-4"><p className="text-xs text-muted-ink">Evidence score</p><p className="mt-2 font-display text-3xl">{record.evaluation.score ?? 'Unknown'}<span className="text-sm"> / 100</span></p></article>
        <article className="border border-acid-lime/20 bg-panel-charcoal p-4"><p className="text-xs text-muted-ink">Decision</p><p className="mt-2 font-display text-2xl uppercase">{record.evaluation.decision}</p></article>
        <article className="border border-acid-lime/20 bg-panel-charcoal p-4"><p className="text-xs text-muted-ink">Last updated</p><p className="mt-2 font-mono text-sm">{new Date(record.updatedAt).toLocaleString()}</p><p className="mt-1 text-xs text-muted-ink">Created {new Date(record.createdAt).toLocaleString()}</p></article>
      </section>

      <form onSubmit={save} className="space-y-7">
        <section className="space-y-4 border border-acid-lime/25 bg-panel-charcoal p-5">
          <div><h2 className="font-display text-2xl uppercase">Opportunity brief</h2><p className="text-xs text-muted-ink">Content changes are version-checked; saves based on an older revision are rejected.</p></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-xs font-mono uppercase">Title<input aria-label="Opportunity title" required minLength={3} maxLength={180} value={draft.title} onChange={(e) => patch('title', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Buyer segment<input aria-label="Buyer segment" required minLength={2} maxLength={300} value={draft.buyerSegment} onChange={(e) => patch('buyerSegment', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
            <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Buyer problem<textarea aria-label="Buyer problem" required minLength={10} maxLength={3000} rows={3} value={draft.buyerProblem} onChange={(e) => patch('buyerProblem', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Job to be done<textarea aria-label="Job to be done" required minLength={5} maxLength={1000} rows={2} value={draft.jobToBeDone} onChange={(e) => patch('jobToBeDone', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Product hypothesis<textarea aria-label="Product hypothesis" required minLength={5} maxLength={2000} rows={2} value={draft.productHypothesis} onChange={(e) => patch('productHypothesis', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Product family<select aria-label="Product family" value={draft.productFamily} onChange={(e) => patch('productFamily', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case"><option value="digital-utility">Digital utility</option><option value="stock-asset">Stock asset</option><option value="affiliate-media">Affiliate media</option><option value="publishing">Publishing</option><option value="workflow-product">Workflow product</option><option value="media">Media</option><option value="game-asset">Game asset</option><option value="microgame">Microgame</option></select></label>
            <label className="space-y-1 text-xs font-mono uppercase">Candidate channels<input aria-label="Candidate channels" value={draft.candidateChannels.join(', ')} onChange={(e) => patch('candidateChannels', e.target.value.split(',').map((v) => v.trim()).filter(Boolean))} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label>
          </div>
        </section>

        <section className="space-y-4 border border-acid-lime/25 p-5">
          <div><h2 className="font-display text-2xl uppercase">Source evidence</h2><p className="text-xs text-muted-ink">Each source retains its classification, capture time, limitations and collection permission basis.</p></div>
          {draft.evidence.map((evidence, index) => <article key={evidence.evidenceId} data-testid="review-evidence" className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4">
            <div className="flex flex-wrap justify-between gap-2"><h3 className="font-display text-lg">{evidence.sourceName}</h3><span className="font-mono text-xs text-acid-lime">{evidence.evidenceClass} · {evidence.reliability}</span></div>
            <label className="block space-y-1 text-[10px] font-mono uppercase">Source name<input aria-label={'Evidence source name ' + (index + 1)} value={evidence.sourceName} onChange={(e) => patchEvidence(index, 'sourceName', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="block space-y-1 text-[10px] font-mono uppercase">Source URL<input aria-label={'Evidence source URL ' + (index + 1)} type="url" value={evidence.sourceUrl} onChange={(e) => patchEvidence(index, 'sourceUrl', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-[10px] font-mono uppercase">Source type<select aria-label={'Evidence source type ' + (index + 1)} value={evidence.sourceType} onChange={(e) => patchEvidence(index, 'sourceType', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{evidenceTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="space-y-1 text-[10px] font-mono uppercase">Evidence class<select aria-label={'Evidence class ' + (index + 1)} value={evidence.evidenceClass} onChange={(e) => patchEvidence(index, 'evidenceClass', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{evidenceClasses.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="space-y-1 text-[10px] font-mono uppercase">Reliability<select aria-label={'Evidence reliability ' + (index + 1)} value={evidence.reliability} onChange={(e) => patchEvidence(index, 'reliability', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{confidences.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <label className="block space-y-1 text-[10px] font-mono uppercase">Evidence summary<textarea aria-label={'Evidence summary ' + (index + 1)} value={evidence.summary} onChange={(e) => patchEvidence(index, 'summary', e.target.value)} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="block space-y-1 text-[10px] font-mono uppercase">Limitations<textarea aria-label={'Evidence limitations ' + (index + 1)} value={evidence.limitations} onChange={(e) => patchEvidence(index, 'limitations', e.target.value)} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <div className="grid gap-3 md:grid-cols-2 text-xs text-muted-ink"><p>Captured: {new Date(evidence.capturedAt).toLocaleString()}</p><p>Evidence ID: {evidence.evidenceId}</p><p>Collection: {evidence.collectionMethod}</p><p>Permission: {evidence.permissionBasis}</p></div>
          </article>)}
        </section>

        <section className="space-y-4 border border-acid-lime/25 p-5">
          <div><h2 className="font-display text-2xl uppercase">Score breakdown</h2><p className="text-xs text-muted-ink">Scores are operator assessments. Every dimension needs rationale, confidence and a linked evidence ID.</p></div>
          <div className="grid gap-3 md:grid-cols-2">{dimensions.map(({ key, label, max }) => <article key={key} className="space-y-2 border border-acid-lime/15 bg-panel-charcoal p-3">
            <label className="flex justify-between text-xs font-mono uppercase">{label}<span className="text-acid-lime">/{max}</span></label>
            <input aria-label={label + ' score'} type="number" min="0" max={max} step="0.01" value={draft.scores[key] ?? ''} onChange={(e) => patchDimension(key, 'score', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" />
            <textarea aria-label={label + ' rationale'} value={draft.scoreDetails[key]?.rationale ?? ''} onChange={(e) => patchDimension(key, 'rationale', e.target.value)} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" placeholder="Rationale" />
            <select aria-label={label + ' confidence'} value={draft.scoreDetails[key]?.confidence ?? 'unknown'} onChange={(e) => patchDimension(key, 'confidence', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{confidences.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <input aria-label={label + ' evidence IDs'} value={(draft.scoreDetails[key]?.evidenceIds ?? []).join(', ')} onChange={(e) => patchDimension(key, 'evidenceIds', e.target.value)} placeholder="Evidence IDs, comma-separated" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" />
          </article>)}</div>
        </section>

        <section className="space-y-4 border border-acid-lime/25 p-5">
          <div><h2 className="font-display text-2xl uppercase">Hard gate assessment</h2><p className="text-xs text-muted-ink">A pass is an operator assessment linked to evidence, not an independent check by the system. Unknown remains a blocker to promotion.</p></div>
          <div className="grid gap-3 md:grid-cols-2">{gates.map(({ key, label }) => <article key={key} className="space-y-2 border border-acid-lime/15 bg-panel-charcoal p-3">
            <h3 className="font-mono text-xs uppercase">{label}</h3>
            <select aria-label={label + ' status'} value={draft.hardGates[key]} onChange={(e) => patchGate(key, 'status', e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{gateStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <textarea aria-label={label + ' rationale'} value={draft.hardGateDetails[key].rationale} onChange={(e) => patchGate(key, 'rationale', e.target.value)} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" />
            <input aria-label={label + ' evidence IDs'} value={draft.hardGateDetails[key].evidenceIds.join(', ')} onChange={(e) => patchGate(key, 'evidenceIds', e.target.value)} placeholder="Evidence IDs, comma-separated" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" />
          </article>)}</div>
        </section>

        <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={saving} className="bg-acid-lime px-6 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Saving revision…' : 'Save opportunity revision'}</button><span className="text-xs text-muted-ink">Current revision {record.revision} · save is conditional on this exact revision</span></div>
      </form>
    </div>
  </main>
}
