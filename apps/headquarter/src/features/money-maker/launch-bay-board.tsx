'use client'

import { useCallback, useEffect, useState } from 'react'

type Channel = {
  id: string
  slug: string
  displayName: string
  capability: 'C0' | 'C1' | 'C2' | 'C3' | 'C4'
  enabled: boolean
  countryEligibility: Array<{ country: string; status: string; sourceUrl?: string; checkedAt?: string }>
  payoutRequirements: { status?: string; sourceUrl?: string; checkedAt?: string; notes?: string }
  policyUrl: string | null
  policyCheckedAt: string | null
  capabilityEvidence: { manualFallback?: string }
  reviewedAt: string | null
}
type Draft = {
  countryStatus: 'pass' | 'blocked' | 'unknown'
  countrySourceUrl: string
  countryCheckedAt: string
  payoutStatus: 'pass' | 'blocked' | 'unknown'
  payoutSourceUrl: string
  payoutCheckedAt: string
  payoutNotes: string
  policyUrl: string
  policyCheckedAt: string
  manualFallback: string
}
const emptyDraft: Draft = {
  countryStatus: 'unknown', countrySourceUrl: '', countryCheckedAt: '',
  payoutStatus: 'unknown', payoutSourceUrl: '', payoutCheckedAt: '',
  payoutNotes: 'Not verified yet.', policyUrl: '', policyCheckedAt: '',
  manualFallback: 'Owner manually uploads the prepared listing package. No automated publishing is authorized.',
}
function iso(value: string) { return value ? new Date(value).toISOString() : undefined }

export function LaunchBayBoard() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviewing, setReviewing] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/channels', { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load channel registry.')
      setChannels(payload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load channel registry.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/channels', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: data.get('slug'), displayName: data.get('displayName') }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to add channel.')
      form.reset()
      setMessage(`Channel added as C0 research-only: ${payload.data.displayName}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add channel.')
    } finally { setSaving(false) }
  }

  async function reviewChannel(channel: Channel) {
    const draft = drafts[channel.id] ?? emptyDraft
    setReviewing(channel.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/channels/${channel.id}/review`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          countryEligibility: [{
            country: 'ID', status: draft.countryStatus,
            ...(draft.countrySourceUrl ? { sourceUrl: draft.countrySourceUrl } : {}),
            ...(draft.countryCheckedAt ? { checkedAt: iso(draft.countryCheckedAt) } : {}),
          }],
          payoutRequirements: {
            status: draft.payoutStatus,
            ...(draft.payoutSourceUrl ? { sourceUrl: draft.payoutSourceUrl } : {}),
            ...(draft.payoutCheckedAt ? { checkedAt: iso(draft.payoutCheckedAt) } : {}),
            notes: draft.payoutNotes,
          },
          ...(draft.policyUrl ? { policyUrl: draft.policyUrl } : {}),
          ...(draft.policyCheckedAt ? { policyCheckedAt: iso(draft.policyCheckedAt) } : {}),
          manualFallback: draft.manualFallback,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to save channel review.')
      setMessage(payload.capabilityDecision === 'manual-package-enabled'
        ? 'Channel is C1: manual listing package preparation is enabled. No API publishing is authorized.'
        : 'Channel remains C0 research-only because one or more Indonesia eligibility, payout, or policy gates are unknown or blocked.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review channel.')
    } finally { setReviewing('') }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft), ...patch } }))
  }

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Distribution Operations</p><h1 className="mt-3 font-display text-5xl uppercase">LAUNCH BAY</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Channel capability is earned through current evidence. C0 means research only. C1 permits a manual listing package only. No unofficial scraping, credential sharing, or unattended publication.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-4"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Channel registry</h2><p className="text-xs text-muted-ink">Persisted registry · no default channel is assumed eligible</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading channel registry…</p> : channels.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No channels registered. Add a channel to begin evidence review.</p> : channels.map((channel) => {
        const draft = drafts[channel.id] ?? emptyDraft
        return <article key={channel.id} className="space-y-4 border border-acid-lime/20 bg-panel-charcoal p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl uppercase">{channel.displayName}</h3><p className="text-xs text-muted-ink">{channel.slug} · {channel.reviewedAt ? `Reviewed ${new Date(channel.reviewedAt).toLocaleString()}` : 'Not reviewed'}</p></div><div className="text-right"><p className="font-mono text-2xl text-acid-lime">{channel.capability}</p><p className="text-[10px] font-mono uppercase">{channel.enabled ? 'Manual package enabled' : 'Research only'}</p></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-mono uppercase">Indonesia account eligibility<select value={draft.countryStatus} onChange={(e) => updateDraft(channel.id, { countryStatus: e.target.value as Draft['countryStatus'] })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Unknown</option><option value="pass">Pass — verified</option><option value="blocked">Blocked</option></select></label>
            <label className="space-y-1 text-xs font-mono uppercase">Eligibility evidence URL<input type="url" value={draft.countrySourceUrl} onChange={(e) => updateDraft(channel.id, { countrySourceUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Eligibility checked at<input type="datetime-local" value={draft.countryCheckedAt} onChange={(e) => updateDraft(channel.id, { countryCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout requirements<select value={draft.payoutStatus} onChange={(e) => updateDraft(channel.id, { payoutStatus: e.target.value as Draft['payoutStatus'] })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Unknown</option><option value="pass">Pass — verified</option><option value="blocked">Blocked</option></select></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout evidence URL<input type="url" value={draft.payoutSourceUrl} onChange={(e) => updateDraft(channel.id, { payoutSourceUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout checked at<input type="datetime-local" value={draft.payoutCheckedAt} onChange={(e) => updateDraft(channel.id, { payoutCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Payout notes<textarea value={draft.payoutNotes} onChange={(e) => updateDraft(channel.id, { payoutNotes: e.target.value })} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Official policy URL<input type="url" value={draft.policyUrl} onChange={(e) => updateDraft(channel.id, { policyUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Policy checked at<input type="datetime-local" value={draft.policyCheckedAt} onChange={(e) => updateDraft(channel.id, { policyCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Manual fallback<textarea value={draft.manualFallback} onChange={(e) => updateDraft(channel.id, { manualFallback: e.target.value })} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
          </div>
          <button type="button" disabled={reviewing === channel.id} onClick={() => void reviewChannel(channel)} className="border border-acid-lime px-4 py-2 font-mono text-xs uppercase disabled:opacity-50">{reviewing === channel.id ? 'Saving review…' : 'Save evidence review'}</button>
        </article>
      })}
    </section>
    <form onSubmit={createChannel} className="grid gap-3 border border-acid-lime/30 bg-panel-charcoal p-5 md:grid-cols-3"><label className="space-y-1 text-xs font-mono uppercase">Channel slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="etsy" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase">Display name<input name="displayName" required minLength={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label><div className="flex items-end"><button disabled={saving} className="w-full bg-acid-lime px-4 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Adding…' : 'Add C0 channel'}</button></div></form>
    <p className="text-xs text-muted-ink">C1 is manual package preparation only. C2–C4 remain unavailable until official API authorization, account health checks, idempotency, quotas and rollback are verified. A channel review is an operator assessment, not an independent marketplace certification.</p>
  </div></main>
}
