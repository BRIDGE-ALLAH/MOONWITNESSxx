'use client'

import Link from 'next/link'
import { OperatorLogoutButton } from './operator-logout-button'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Opportunity = {
  id: string
  title: string
  buyerSegment: string
  buyerProblem: string
  evaluation: { score: number | null; decision: string; blockedGates: string[]; unknownGates: string[]; missingScoreDimensions: string[] }
}
type Decision = 'blocked' | 'research-more' | 'prototype-candidate' | 'park'
type DecisionDraft = { decision: Decision; rationale: string }
const dimensions = [
  ['demandEvidence', 'Demand evidence', 25],
  ['competitionGap', 'Competition / quality gap', 20],
  ['usefulnessDifferentiation', 'Usefulness / differentiation', 15],
  ['marketplaceFit', 'Marketplace / buyer-intent fit', 15],
  ['productionFeasibility', 'Production feasibility', 10],
  ['durability', 'Durability / repeat demand', 10],
  ['distributionReadiness', 'Distribution readiness', 5],
] as const
const gates = [['rights', 'Rights & licensing'], ['countryEligibility', 'Country eligibility'], ['channelPolicy', 'Channel policy'], ['payoutFeasibility', 'Payout feasibility']] as const
const emptyScores = Object.fromEntries(dimensions.map(([key]) => [key, ''])) as Record<string, string>
const emptyRationales = Object.fromEntries(dimensions.map(([key]) => [key, ''])) as Record<string, string>
const emptyGates = Object.fromEntries(gates.map(([key]) => [key, 'unknown'])) as Record<string, 'pass' | 'blocked' | 'unknown'>
const emptyGateRationales = Object.fromEntries(gates.map(([key]) => [key, 'Not verified yet.'])) as Record<string, string>

export function OpportunityBoard() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [opportunityIdempotencyKey, setOpportunityIdempotencyKey] = useState('')
  const [evidenceCapturedAt, setEvidenceCapturedAt] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, DecisionDraft>>({})
  const [scores, setScores] = useState(emptyScores)
  const [scoreRationales, setScoreRationales] = useState(emptyRationales)
  const [hardGates, setHardGates] = useState(emptyGates)
  const [gateRationales, setGateRationales] = useState(emptyGateRationales)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/opportunities?limit=100', { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load opportunities.')
      setItems(payload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load opportunities.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(''); setMessage('')
    const form = event.currentTarget
    const data = new FormData(form)
    const evidenceId = 'operator-source-1'
    const scoreValues: Record<string, number> = {}
    const scoreDetails: Record<string, { rationale: string; confidence: string; evidenceIds: string[] }> = {}
    for (const [key] of dimensions) {
      if (scores[key] !== '') {
        scoreValues[key] = Number(scores[key])
        scoreDetails[key] = { rationale: scoreRationales[key].trim(), confidence: String(data.get(`confidence-${key}`) || 'unknown'), evidenceIds: [evidenceId] }
      }
    }
    const hardGateDetails = Object.fromEntries(gates.map(([key]) => [key, {
      status: hardGates[key], rationale: gateRationales[key].trim(), evidenceIds: hardGates[key] === 'unknown' ? [] : [evidenceId],
    }]))
    const capturedAt = evidenceCapturedAt || new Date().toISOString()
    setEvidenceCapturedAt(capturedAt)
    const payload = {
      title: String(data.get('title') || ''), buyerProblem: String(data.get('buyerProblem') || ''),
      buyerSegment: String(data.get('buyerSegment') || ''), jobToBeDone: String(data.get('jobToBeDone') || ''),
      productHypothesis: String(data.get('productHypothesis') || ''), productFamily: String(data.get('productFamily') || 'digital-utility'),
      candidateChannels: String(data.get('candidateChannels') || '').split(',').map((v) => v.trim()).filter(Boolean),
      evidence: [{
        evidenceId, sourceName: String(data.get('sourceName') || ''), sourceUrl: String(data.get('sourceUrl') || ''),
        sourceType: String(data.get('sourceType') || 'other'), capturedAt,
        evidenceClass: String(data.get('evidenceClass') || 'unknown'), summary: String(data.get('summary') || ''),
        reliability: String(data.get('reliability') || 'unknown'), limitations: String(data.get('limitations') || ''),
        collectionMethod: String(data.get('collectionMethod') || ''), permissionBasis: String(data.get('permissionBasis') || ''),
      }],
      scores: scoreValues, scoreDetails, hardGates, hardGateDetails,
    }
    try {
      const stableIdempotencyKey = opportunityIdempotencyKey || `opportunity-${crypto.randomUUID()}`
      setOpportunityIdempotencyKey(stableIdempotencyKey)
      const response = await fetch('/api/opportunities', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': stableIdempotencyKey }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(result.error?.message || 'Unable to save opportunity.')
      form.reset()
      setOpportunityIdempotencyKey('')
      setEvidenceCapturedAt('')
      setScores({ ...emptyScores }); setScoreRationales({ ...emptyRationales }); setHardGates({ ...emptyGates }); setGateRationales({ ...emptyGateRationales })
      setMessage('Opportunity saved. Review evidence and hard gates before production.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save opportunity.')
    } finally { setSaving(false) }
  }


  async function updateDecision(item: Opportunity) {
    const draft = decisionDrafts[item.id] ?? { decision: item.evaluation.decision as Decision, rationale: '' }
    if (draft.rationale.trim().length < 10) {
      setError('Decision rationale must contain at least 10 characters.')
      return
    }
    setActionId(item.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/opportunities/${item.id}/decision`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision: draft.decision, rationale: draft.rationale.trim() }),
      })
      const result = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(result.error?.message || 'Unable to update opportunity decision.')
      setDecisionDrafts((current) => ({ ...current, [item.id]: { ...draft, rationale: '' } }))
      setMessage('Decision updated and recorded in the audit trail.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update opportunity decision.')
    } finally {
      setActionId(null)
    }
  }

  async function archiveOpportunity(item: Opportunity) {
    if (!window.confirm(`Archive "${item.title}"? The record will be retained in the audit history.`)) return
    setActionId(item.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/opportunities/${item.id}`, { method: 'DELETE' })
      const result = response.status === 204 ? null : await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(result?.error?.message || 'Unable to archive opportunity.')
      setMessage('Opportunity archived. Its audit history is retained.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive opportunity.')
    } finally {
      setActionId(null)
    }
  }

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><div className="mb-3 flex justify-end"><OperatorLogoutButton /></div><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Market Intelligence</p><h1 className="mt-3 font-display text-5xl uppercase">RIOT RADAR</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Capture a real buyer problem, preserve source evidence, and evaluate the opportunity. Scores, confidence, and gate states are operator assessments—not independent source verification. Missing evidence stays unknown.</p></header>
    {error && <div role="alert" className="border border-red-500/50 bg-red-950/20 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Opportunity register</h2><p className="text-xs text-muted-ink">Persisted records from ARSY · no sample rows</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading persisted opportunities…</p> : items.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No opportunities recorded yet. Capture the first source-backed buyer problem below.</p> : <div className="grid gap-3 md:grid-cols-2">{items.map((item) => {
        const eligible = item.evaluation.decision === 'prototype-candidate'
          && item.evaluation.score !== null
          && item.evaluation.score >= 80
          && item.evaluation.blockedGates.length === 0
          && item.evaluation.unknownGates.length === 0
          && item.evaluation.missingScoreDimensions.length === 0
        const draft = decisionDrafts[item.id] ?? { decision: item.evaluation.decision as Decision, rationale: '' }
        return <article data-testid="opportunity-card" key={item.id} className="border border-acid-lime/20 bg-panel-charcoal p-4"><div className="flex justify-between gap-3"><h3 className="font-display text-xl uppercase">{item.title}</h3><span className="font-mono text-xs text-acid-lime">{item.evaluation.score === null ? 'UNSCORED' : `${item.evaluation.score}/100`}</span></div><p className="mt-2 text-sm text-muted-ink">{item.buyerSegment}</p><p className="mt-3 text-sm">{item.buyerProblem}</p><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono uppercase"><span className="border border-acid-lime/30 px-2 py-1">{item.evaluation.decision}</span>{item.evaluation.blockedGates.map((g) => <span key={g} className="border border-red-500/50 px-2 py-1 text-red-300">BLOCKED: {g}</span>)}{item.evaluation.unknownGates.map((g) => <span key={g} className="border border-orange-400/50 px-2 py-1 text-orange-200">UNKNOWN: {g}</span>)}</div>
          {eligible ? <p className="mt-4 border-t border-acid-lime/20 pt-3 text-xs"><Link href="/the-forge" className="font-mono uppercase text-acid-lime underline">Ready for product brief in The Forge →</Link></p>
            : <p className="mt-4 border-t border-acid-lime/20 pt-3 text-xs text-muted-ink">Product promotion is locked until every score dimension is complete and all hard gates are passed.</p>}
          <div className="mt-4 space-y-2 border-t border-acid-lime/15 pt-4">
            <label className="block space-y-1 text-[10px] font-mono uppercase text-muted-ink">Operator decision
              <select aria-label={`Decision for ${item.title}`} value={draft.decision} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [item.id]: { ...draft, decision: event.target.value as Decision } }))} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone">
                <option value="blocked">Blocked</option><option value="research-more">Research more</option><option value="prototype-candidate">Prototype candidate</option><option value="park">Park</option>
              </select>
            </label>
            <label className="block space-y-1 text-[10px] font-mono uppercase text-muted-ink">Decision rationale (minimum 10 characters)
              <textarea aria-label={`Decision rationale for ${item.title}`} value={draft.rationale} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [item.id]: { ...draft, rationale: event.target.value } }))} rows={2} maxLength={2000} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" placeholder="Why this decision is appropriate based on the current evidence." />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={actionId === item.id || draft.rationale.trim().length < 10} onClick={() => void updateDecision(item)} className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40">{actionId === item.id ? 'Saving…' : 'Save decision'}</button>
              <button type="button" disabled={actionId === item.id} onClick={() => void archiveOpportunity(item)} data-testid="archive-opportunity" className="border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase text-red-300 disabled:opacity-40">Archive</button>
            </div>
          </div>
        </article>
      })}</div>}
    </section>
    <form data-testid="opportunity-form" onSubmit={createOpportunity} onChange={() => { if (opportunityIdempotencyKey) { setOpportunityIdempotencyKey(''); setEvidenceCapturedAt('') } }} className="space-y-6 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7">
      <div><h2 className="font-display text-2xl uppercase">Capture opportunity</h2><p className="text-xs text-muted-ink">One source-backed opportunity per submission. No automated scraping or fabricated demand signals.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs font-mono uppercase">Opportunity title<input name="title" required minLength={3} maxLength={180} className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Buyer segment<input name="buyerSegment" required minLength={2} maxLength={300} className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Buyer problem<textarea name="buyerProblem" required minLength={10} maxLength={3000} rows={3} className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Job to be done<textarea name="jobToBeDone" required minLength={5} maxLength={1000} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Product hypothesis<textarea name="productHypothesis" required minLength={5} maxLength={2000} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Product family<select name="productFamily" className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case"><option value="digital-utility">Digital utility</option><option value="stock-asset">Stock asset</option><option value="affiliate-media">Affiliate media</option><option value="publishing">Publishing</option><option value="workflow-product">Workflow product</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Candidate channels<input name="candidateChannels" placeholder="Gumroad, Etsy" className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
      </div>
      <div className="space-y-3 border-t border-acid-lime/20 pt-5"><h3 className="font-display text-xl uppercase">Source evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-xs font-mono uppercase">Source name<input name="sourceName" required className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Canonical source URL<input name="sourceUrl" type="url" required className="w-full border border-acid-lime/20 bg-obsidian p-3 font-sans text-sm normal-case" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Source type<select name="sourceType" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="official-documentation">Official documentation</option><option value="official-marketplace">Official marketplace</option><option value="public-review">Public review</option><option value="public-community">Public community</option><option value="search-trend">Search trend</option><option value="github">GitHub</option><option value="other">Other</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Evidence class<select name="evidenceClass" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="observed-fact">Observed fact</option><option value="community-anecdote">Community anecdote</option><option value="inference">Inference</option><option value="hypothesis">Hypothesis</option><option value="unknown">Unknown</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Reliability<select name="reliability" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="unknown">Unknown</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Collection method<input name="collectionMethod" required className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Permission basis<input name="permissionBasis" required className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Evidence summary<textarea name="summary" required rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Limitations<textarea name="limitations" required rows={2} placeholder="What this source does not establish" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-xs" /></label>
      </div></div>
      <div className="space-y-3 border-t border-acid-lime/20 pt-5"><h3 className="font-display text-xl uppercase">Opportunity score / 100</h3><p className="text-xs text-muted-ink">Leave a dimension blank when evidence is missing. Every scored dimension needs rationale and confidence.</p><div className="grid gap-4 md:grid-cols-2">{dimensions.map(([key, label, weight]) => <div key={key} className="space-y-2 border border-acid-lime/10 p-3"><label className="flex justify-between text-xs font-mono uppercase"><span>{label}</span><span className="text-acid-lime">/{weight}</span></label><input aria-label={`${label} score`} type="number" min="0" max={weight} value={scores[key]} onChange={(e) => setScores((v) => ({ ...v, [key]: e.target.value }))} placeholder="Unknown" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" /><textarea aria-label={`${label} rationale`} value={scoreRationales[key]} onChange={(e) => setScoreRationales((v) => ({ ...v, [key]: e.target.value }))} placeholder="Rationale (required if scored)" rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /><select name={`confidence-${key}`} aria-label={`${label} confidence`} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Confidence unknown</option><option value="low">Low confidence</option><option value="medium">Medium confidence</option><option value="high">High confidence</option></select></div>)}</div></div>
      <div className="space-y-3 border-t border-acid-lime/20 pt-5"><h3 className="font-display text-xl uppercase">Hard gates</h3><p className="text-xs text-muted-ink">Gate states are operator-entered assessments linked to cited evidence; MOONWITNESS does not independently verify them. Unknown is the safe default. A high score cannot override a blocked or unknown gate. Gate passes are operator assessments, not independent provider verification.</p><div className="grid gap-4 md:grid-cols-2">{gates.map(([key, label]) => <div key={key} className="space-y-2 border border-acid-lime/10 p-3"><label className="text-xs font-mono uppercase">{label}</label><select aria-label={`${label} hard gate`} value={hardGates[key]} onChange={(e) => setHardGates((v) => ({ ...v, [key]: e.target.value as 'pass' | 'blocked' | 'unknown' }))} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Unknown / not checked</option><option value="pass">Pass — operator assessed</option><option value="blocked">Blocked — operator assessed</option></select><textarea aria-label={`${label} gate rationale`} value={gateRationales[key]} onChange={(e) => setGateRationales((v) => ({ ...v, [key]: e.target.value }))} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></div>)}</div></div>
      <button data-testid="save-opportunity" type="submit" disabled={saving} className="border border-acid-lime bg-acid-lime px-6 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Saving to ARSY…' : 'Save evidence-backed opportunity'}</button>
    </form>
  </div></main>
}
