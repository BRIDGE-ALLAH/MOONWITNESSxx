'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Channel = {
  id: string; slug: string; displayName: string; capability: 'C0' | 'C1' | 'C2' | 'C3' | 'C4'; enabled: boolean
  countryEligibility: Array<{ country: string; status: string; sourceUrl?: string; checkedAt?: string }>
  payoutRequirements: { status?: string; sourceUrl?: string; checkedAt?: string; notes?: string }
  policyUrl: string | null; policyCheckedAt: string | null
  capabilityEvidence: { manualFallback?: string }; reviewedAt: string | null
}
type Product = { id: string; title: string; versionId: string; version: number; lifecycleState: string; brief: Record<string, unknown> }
type Listing = { id: string; productVersionId: string; channelId: string; channelName: string; productTitle: string; status: string; listingPackage: Record<string, unknown>; providerReference: string | null; publishedAt: string | null }
type ReviewDraft = {
  countryStatus: 'pass' | 'blocked' | 'unknown'; countrySourceUrl: string; countryCheckedAt: string
  payoutStatus: 'pass' | 'blocked' | 'unknown'; payoutSourceUrl: string; payoutCheckedAt: string; payoutNotes: string
  policyUrl: string; policyCheckedAt: string; manualFallback: string
}
const emptyDraft: ReviewDraft = {
  countryStatus: 'unknown', countrySourceUrl: '', countryCheckedAt: '',
  payoutStatus: 'unknown', payoutSourceUrl: '', payoutCheckedAt: '', payoutNotes: 'Not verified yet.',
  policyUrl: '', policyCheckedAt: '',
  manualFallback: 'Owner manually uploads the prepared listing package. No automated publishing is authorized.',
}
function iso(value: string) { return value ? new Date(value).toISOString() : undefined }
function localDateTime() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function LaunchBayBoard() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [reviewing, setReviewing] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const responses = await Promise.all([
        fetch('/api/channels', { cache: 'no-store' }),
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/listings', { cache: 'no-store' }),
      ])
      const payloads = await Promise.all(responses.map((response) => response.json()))
      if (responses.some((response) => response.status === 401)) throw new Error('Operator login required. Sign in at /login.')
      const failed = responses.findIndex((response) => !response.ok)
      if (failed >= 0) throw new Error(payloads[failed].error?.message || 'Unable to load distribution records.')
      setChannels(payloads[0].data ?? []); setProducts(payloads[1].data ?? []); setListings(payloads[2].data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load distribution records.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving('channel'); setError(''); setMessage('')
    try {
      const response = await fetch('/api/channels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: data.get('slug'), displayName: data.get('displayName') }) })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to add channel.')
      form.reset(); setMessage(`Channel added as C0 research-only: ${payload.data.displayName}.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add channel.') }
    finally { setSaving('') }
  }

  async function reviewChannel(channel: Channel) {
    const draft = drafts[channel.id] ?? emptyDraft
    setReviewing(channel.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/channels/${channel.id}/review`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          countryEligibility: [{ country: 'ID', status: draft.countryStatus, ...(draft.countrySourceUrl ? { sourceUrl: draft.countrySourceUrl } : {}), ...(draft.countryCheckedAt ? { checkedAt: iso(draft.countryCheckedAt) } : {}) }],
          payoutRequirements: { status: draft.payoutStatus, ...(draft.payoutSourceUrl ? { sourceUrl: draft.payoutSourceUrl } : {}), ...(draft.payoutCheckedAt ? { checkedAt: iso(draft.payoutCheckedAt) } : {}), notes: draft.payoutNotes },
          ...(draft.policyUrl ? { policyUrl: draft.policyUrl } : {}), ...(draft.policyCheckedAt ? { policyCheckedAt: iso(draft.policyCheckedAt) } : {}),
          manualFallback: draft.manualFallback,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to save channel review.')
      setMessage(payload.capabilityDecision === 'manual-package-enabled' ? 'C1 manual listing package enabled. No API publishing is authorized.' : 'Channel remains C0 because eligibility, payout or policy evidence is unknown or blocked.')
      await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to review channel.') }
    finally { setReviewing('') }
  }

  function updateDraft(id: string, patch: Partial<ReviewDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft), ...patch } }))
  }

  async function createListing(event: FormEvent<HTMLFormElement>, product: Product, channel: Channel) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving(`listing:${product.id}:${channel.id}`); setError(''); setMessage('')
    try {
      const response = await fetch('/api/listings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productVersionId: product.versionId, channelId: channel.id,
          title: data.get('title'), description: data.get('description'),
          tags: String(data.get('tags') || '').split(',').map((v) => v.trim()).filter(Boolean),
          priceMinor: data.get('priceMinor'), currency: String(data.get('currency') || 'IDR').toUpperCase(),
          disclosures: String(data.get('disclosures') || '').split('\n').map((v) => v.trim()).filter(Boolean),
          manualUploadInstructions: data.get('manualUploadInstructions'),
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to create listing package.')
      form.reset(); setMessage(`Manual listing package ready for ${channel.displayName}. Nothing has been published automatically.`); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create listing package.') }
    finally { setSaving('') }
  }

  async function recordReceipt(event: FormEvent<HTMLFormElement>, listing: Listing) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving(`receipt:${listing.id}`); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/listings/${listing.id}/publication-receipt`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerReference: data.get('providerReference'),
          evidenceUrl: data.get('evidenceUrl'),
          publishedAt: iso(String(data.get('publishedAt') || '')),
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record publication receipt.')
      form.reset(); setMessage('Manual publication receipt recorded with its evidence reference.'); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to record publication receipt.') }
    finally { setSaving('') }
  }

  const enabledChannels = channels.filter((channel) => channel.capability === 'C1' && channel.enabled)
  const readyProducts = products.filter((product) => product.lifecycleState === 'ready')
  const existingPairs = new Set(listings.map((listing) => `${listing.productVersionId}:${listing.channelId}`))

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Distribution Operations</p><h1 className="mt-3 font-display text-5xl uppercase">LAUNCH BAY</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Channel capability is earned through current evidence. C0 means research only. C1 permits manual listing packages only. No scraping, credential sharing or unattended publication.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="space-y-4"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Channel registry</h2><p className="text-xs text-muted-ink">C0 research → C1 manual package, only after evidence review</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading distribution records…</p> : channels.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No channels registered.</p> : channels.map((channel) => {
        const draft = drafts[channel.id] ?? emptyDraft
        return <article key={channel.id} className="space-y-4 border border-acid-lime/20 bg-panel-charcoal p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-xl uppercase">{channel.displayName}</h3><p className="text-xs text-muted-ink">{channel.slug} · {channel.reviewedAt ? `Reviewed ${new Date(channel.reviewedAt).toLocaleString()}` : 'Not reviewed'}</p></div><div className="text-right"><p className="font-mono text-2xl text-acid-lime">{channel.capability}</p><p className="text-[10px] font-mono uppercase">{channel.enabled ? 'Manual package enabled' : 'Research only'}</p></div></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-mono uppercase">Indonesia account eligibility<select value={draft.countryStatus} onChange={(e) => updateDraft(channel.id, { countryStatus: e.target.value as ReviewDraft['countryStatus'] })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Unknown</option><option value="pass">Pass — verified</option><option value="blocked">Blocked</option></select></label>
            <label className="space-y-1 text-xs font-mono uppercase">Eligibility evidence URL<input type="url" value={draft.countrySourceUrl} onChange={(e) => updateDraft(channel.id, { countrySourceUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Eligibility checked at<input type="datetime-local" value={draft.countryCheckedAt} onChange={(e) => updateDraft(channel.id, { countryCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout requirements<select value={draft.payoutStatus} onChange={(e) => updateDraft(channel.id, { payoutStatus: e.target.value as ReviewDraft['payoutStatus'] })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs"><option value="unknown">Unknown</option><option value="pass">Pass — verified</option><option value="blocked">Blocked</option></select></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout evidence URL<input type="url" value={draft.payoutSourceUrl} onChange={(e) => updateDraft(channel.id, { payoutSourceUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Payout checked at<input type="datetime-local" value={draft.payoutCheckedAt} onChange={(e) => updateDraft(channel.id, { payoutCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Payout notes<textarea value={draft.payoutNotes} onChange={(e) => updateDraft(channel.id, { payoutNotes: e.target.value })} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Official policy URL<input type="url" value={draft.policyUrl} onChange={(e) => updateDraft(channel.id, { policyUrl: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase">Policy checked at<input type="datetime-local" value={draft.policyCheckedAt} onChange={(e) => updateDraft(channel.id, { policyCheckedAt: e.target.value })} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
            <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Manual fallback<textarea value={draft.manualFallback} onChange={(e) => updateDraft(channel.id, { manualFallback: e.target.value })} rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
          </div>
          <button type="button" disabled={reviewing === channel.id} onClick={() => void reviewChannel(channel)} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase disabled:opacity-50">{reviewing === channel.id ? 'Saving review…' : 'Save evidence review'}</button>
        </article>
      })}
    </section>
    <form onSubmit={createChannel} className="grid gap-3 border border-acid-lime/30 bg-panel-charcoal p-5 md:grid-cols-3"><label className="space-y-1 text-xs font-mono uppercase">Channel slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="etsy" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase">Display name<input name="displayName" required minLength={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label><div className="flex items-end"><button disabled={saving === 'channel'} className="w-full bg-acid-lime px-4 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving === 'channel' ? 'Adding…' : 'Add C0 channel'}</button></div></form>

    <section className="space-y-4"><div><h2 className="font-display text-2xl uppercase">Manual listing packages</h2><p className="text-xs text-muted-ink">Requires READY product version and enabled C1 channel. Packages are prepared here; owner publishes manually on the marketplace.</p></div>
      {readyProducts.length === 0 || enabledChannels.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No eligible product/channel pair. Complete all four product inspections and verify an Indonesian C1 channel first.</p> : readyProducts.flatMap((product) => enabledChannels.filter((channel) => !existingPairs.has(`${product.versionId}:${channel.id}`)).map((channel) => <form key={`${product.id}:${channel.id}`} onSubmit={(event) => void createListing(event, product, channel)} className="grid gap-3 border border-acid-lime/20 bg-panel-charcoal p-5 md:grid-cols-2"><div className="md:col-span-2"><h3 className="font-display text-xl uppercase">{product.title}</h3><p className="text-xs text-muted-ink">v{product.version} · {channel.displayName} · C1 manual</p></div><label className="space-y-1 text-xs font-mono uppercase">Listing title<input name="title" required defaultValue={product.title} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase">Tags (comma separated)<input name="tags" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Description<textarea name="description" required minLength={20} defaultValue={String(product.brief.productHypothesis ?? '')} rows={3} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase">Price (minor units)<input name="priceMinor" required pattern="[1-9][0-9]{0,17}" inputMode="numeric" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm" /></label><label className="space-y-1 text-xs font-mono uppercase">Currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" defaultValue="IDR" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-sm uppercase" /></label><label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Required disclosures (one per line)<textarea name="disclosures" rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Manual upload instructions<textarea name="manualUploadInstructions" required minLength={20} defaultValue="Upload the approved files manually. Verify preview, metadata, pricing, disclosures and final marketplace policy before publishing." rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><button disabled={saving.startsWith('listing:')} className="bg-acid-lime px-4 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50 md:col-span-2">{saving === `listing:${product.id}:${channel.id}` ? 'Preparing…' : 'Prepare manual listing package'}</button></form>))}
      {listings.map((listing) => <article key={listing.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-display text-xl uppercase">{listing.productTitle}</h3><p className="text-xs text-muted-ink">{listing.channelName} · {listing.status}</p></div><span className="font-mono text-xs text-acid-lime">{listing.status.toUpperCase()}</span></div><p className="text-sm">{String(listing.listingPackage.title ?? '')} · {String(listing.listingPackage.currency ?? '')} {String(listing.listingPackage.priceMinor ?? '')} minor units</p>{listing.status !== 'published' && <form onSubmit={(event) => void recordReceipt(event, listing)} className="grid gap-3 border-t border-acid-lime/15 pt-3 md:grid-cols-2"><p className="text-xs text-muted-ink md:col-span-2">After you manually publish on the external channel, record the provider reference and public receipt evidence here.</p><label className="space-y-1 text-xs font-mono uppercase">Provider listing reference<input name="providerReference" required className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><label className="space-y-1 text-xs font-mono uppercase">Publication evidence URL<input name="evidenceUrl" type="url" required className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><label className="space-y-1 text-xs font-mono uppercase">Published at<input name="publishedAt" type="datetime-local" required defaultValue={localDateTime()} className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label><button disabled={saving === `receipt:${listing.id}`} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase disabled:opacity-50">{saving === `receipt:${listing.id}` ? 'Recording…' : 'Record manual publication receipt'}</button></form>}</article>)}
    </section>
    <p className="text-xs text-muted-ink">C1 is manual package preparation only. C2–C4 remain disabled until official API authorization, account health checks, idempotency, quotas and rollback are verified. A channel review is an operator assessment, not independent marketplace certification.</p>
  </div></main>
}
