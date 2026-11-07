'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type ChannelEvidence = {
  id: string
  evidenceType: 'official-policy' | 'account-eligibility' | 'payout-requirements' | 'api-capability' | 'other'
  sourceName: string
  sourceUrl: string
  capturedAt: string
  reviewedAt: string | null
  evidenceClass: 'observed-fact' | 'operator-attestation' | 'inference' | 'unknown'
  summary: string
  limitations: string
}
type Channel = {
  id: string
  channelKey: string
  displayName: string
  countryCode: string
  accountEligibility: 'eligible' | 'ineligible' | 'unknown'
  officialPolicyUrl: string | null
  policyReviewedAt: string | null
  policyRecheckAt: string | null
  payoutRequirements: Record<string, unknown>
  payoutSetupStatus: 'configured' | 'not-configured' | 'unavailable' | 'unknown'
  capability: 'C0' | 'C1'
  grantedScopes: string[]
  quotaNotes: Record<string, unknown>
  channelStatus: 'active' | 'paused'
  revision: number
}
type Product = {
  id: string
  title: string
  productFamily: string
  lifecycleState: string
  version: number
  brief: Record<string, unknown>
  acceptanceCriteria: string[]
}
type Gate = { key: string; status: 'pass' | 'blocked' | 'unknown'; rationale: string; evidence: string[] }
type Listing = {
  id: string
  productId: string
  productVersion: number
  channelId: string
  status: 'blocked' | 'ready' | 'submitted' | 'published' | 'withdrawn'
  listingPackage: Record<string, unknown>
  packageHash: string
  readinessSnapshot: { ready: boolean; gates: Gate[] }
  disclosure: string
  createdAt: string
  submittedAt: string | null
  publishedAt: string | null
}
type ChannelDraft = {
  capability: 'C0' | 'C1'
  accountEligibility: Channel['accountEligibility']
  payoutSetupStatus: Channel['payoutSetupStatus']
  officialPolicyUrl: string
  policyReviewedAt: string
  policyRecheckAt: string
  countryCode: string
  channelStatus: Channel['channelStatus']
  payoutRequirements: string
  grantedScopes: string
  quotaNotes: string
}
type ReceiptDraft = {
  externalListingId: string
  publicUrl: string
  evidenceReference: string
  confirmation: string
}
const initialChannelForm = {
  channelKey: '', displayName: '', countryCode: 'ID', accountEligibility: 'unknown' as Channel['accountEligibility'],
  officialPolicyUrl: '', policyReviewedAt: '', policyRecheckAt: '', payoutRequirements: '{}',
  payoutSetupStatus: 'unknown' as Channel['payoutSetupStatus'], capability: 'C0' as Channel['capability'],
  grantedScopes: '', quotaNotes: '{}', policySummary: '', accountEvidenceUrl: '', payoutEvidenceUrl: '',
}
const isoDate = (value: string) => value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null

export function LaunchBayBoard() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelEvidence, setChannelEvidence] = useState<Record<string, ChannelEvidence[]>>({})
  const [channelDrafts, setChannelDrafts] = useState<Record<string, ChannelDraft>>({})
  const [products, setProducts] = useState<Product[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [listingDrafts, setListingDrafts] = useState<Record<string, { channelId: string; disclosure: string }>>({})
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, ReceiptDraft>>({})
  const [channelForm, setChannelForm] = useState(initialChannelForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [channelResponse, productResponse, listingResponse] = await Promise.all([
        fetch('/api/channels', { cache: 'no-store' }),
        fetch('/api/products?limit=100', { cache: 'no-store' }),
        fetch('/api/listings', { cache: 'no-store' }),
      ])
      const [channelPayload, productPayload, listingPayload] = await Promise.all([
        channelResponse.json(), productResponse.json(), listingResponse.json(),
      ])
      if ([channelResponse, productResponse, listingResponse].some((response) => response.status === 401)) throw new Error('Operator login required. Sign in at /login.')
      if (!channelResponse.ok || !productResponse.ok || !listingResponse.ok) {
        throw new Error(channelPayload.error?.message || productPayload.error?.message || listingPayload.error?.message || 'Unable to load Launch Bay records.')
      }
      const nextChannels: Channel[] = channelPayload.data ?? []
      setChannels(nextChannels)
      setProducts(productPayload.data ?? [])
      setListings(listingPayload.data ?? [])
      const evidenceEntries = await Promise.all(nextChannels.map(async (channel) => {
        const response = await fetch(`/api/channels/${channel.id}/evidence`, { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Unable to load channel evidence.')
        return [channel.id, payload.data as ChannelEvidence[]] as const
      }))
      const evidenceMap = Object.fromEntries(evidenceEntries)
      setChannelEvidence(evidenceMap)
      setChannelDrafts((current) => {
        const next = { ...current }
        for (const channel of nextChannels) {
          if (!next[channel.id]) next[channel.id] = {
            capability: channel.capability,
            accountEligibility: channel.accountEligibility,
            payoutSetupStatus: channel.payoutSetupStatus,
            officialPolicyUrl: channel.officialPolicyUrl ?? '',
            policyReviewedAt: channel.policyReviewedAt?.slice(0, 10) ?? '',
            policyRecheckAt: channel.policyRecheckAt?.slice(0, 10) ?? '',
            countryCode: channel.countryCode,
            channelStatus: channel.channelStatus,
            payoutRequirements: JSON.stringify(channel.payoutRequirements, null, 2),
            grantedScopes: channel.grantedScopes.join(', '),
            quotaNotes: JSON.stringify(channel.quotaNotes, null, 2),
          }
        }
        return next
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Launch Bay records.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving('channel'); setError(''); setMessage('')
    try {
      const capturedAt = new Date().toISOString()
      const evidence: Array<Record<string, unknown>> = []
      if (channelForm.officialPolicyUrl.trim()) evidence.push({
        evidenceType: 'official-policy', sourceName: `${channelForm.displayName} official policy`,
        sourceUrl: channelForm.officialPolicyUrl.trim(), capturedAt,
        reviewedAt: isoDate(channelForm.policyReviewedAt), evidenceClass: 'observed-fact',
        summary: channelForm.policySummary.trim() || 'Official policy page captured for manual review.',
        limitations: 'Manual capture; policy changes must be rechecked before use.',
      })
      if (channelForm.accountEvidenceUrl.trim()) evidence.push({
        evidenceType: 'account-eligibility', sourceName: `${channelForm.displayName} account eligibility`,
        sourceUrl: channelForm.accountEvidenceUrl.trim(), capturedAt, evidenceClass: 'operator-attestation',
        summary: 'Operator-supplied evidence for the seller account and country eligibility.',
        limitations: 'Operator attestation; not independently verified by the channel.',
      })
      if (channelForm.payoutEvidenceUrl.trim()) evidence.push({
        evidenceType: 'payout-requirements', sourceName: `${channelForm.displayName} payout setup`,
        sourceUrl: channelForm.payoutEvidenceUrl.trim(), capturedAt, evidenceClass: 'operator-attestation',
        summary: 'Operator-supplied evidence for payout requirements and setup status.',
        limitations: 'No bank account numbers or payout credentials are stored in this registry.',
      })
      const response = await fetch('/api/channels', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channelKey: channelForm.channelKey, displayName: channelForm.displayName,
          countryCode: channelForm.countryCode, accountEligibility: channelForm.accountEligibility,
          officialPolicyUrl: channelForm.officialPolicyUrl || null,
          policyReviewedAt: isoDate(channelForm.policyReviewedAt),
          policyRecheckAt: isoDate(channelForm.policyRecheckAt),
          payoutRequirements: JSON.parse(channelForm.payoutRequirements),
          payoutSetupStatus: channelForm.payoutSetupStatus, capability: channelForm.capability,
          grantedScopes: channelForm.grantedScopes.split(',').map((item) => item.trim()).filter(Boolean),
          quotaNotes: JSON.parse(channelForm.quotaNotes), channelStatus: 'active', evidence,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to register channel.')
      setMessage(`Channel registered: ${payload.data.displayName} · ${payload.data.capability}`)
      setChannelForm(initialChannelForm)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register channel. Check payout and quota JSON.')
    } finally { setSaving('') }
  }

  async function updateChannel(channel: Channel) {
    const draft = channelDrafts[channel.id]
    if (!draft) return
    setSaving(channel.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...draft, expectedRevision: channel.revision,
          officialPolicyUrl: draft.officialPolicyUrl || null,
          policyReviewedAt: isoDate(draft.policyReviewedAt),
          policyRecheckAt: isoDate(draft.policyRecheckAt),
          payoutRequirements: JSON.parse(draft.payoutRequirements),
          grantedScopes: draft.grantedScopes.split(',').map((item) => item.trim()).filter(Boolean),
          quotaNotes: JSON.parse(draft.quotaNotes), evidence: [],
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (response.status === 409) throw new Error('Channel changed in another session. Refresh and review before retrying.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to update channel.')
      setMessage(`Channel updated to revision ${payload.data.revision}. Evidence history is append-only.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update channel. Check JSON fields.')
    } finally { setSaving('') }
  }

  async function createPackage(product: Product) {
    const draft = listingDrafts[product.id]
    if (!draft?.channelId) { setError('Select a channel before generating a listing package.'); return }
    setSaving(product.id); setError(''); setMessage('')
    try {
      const response = await fetch('/api/listings/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ productId: product.id, productVersion: product.version, channelId: draft.channelId, disclosure: draft.disclosure }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to generate listing package.')
      setMessage(`Manual listing package generated · ${payload.data.status} · SHA-256 ${payload.data.packageHash}`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate listing package.')
    } finally { setSaving('') }
  }

  function defaultReceiptType(listing: Listing): ReceiptDraft {
    return receiptDrafts[listing.id] ?? { externalListingId: '', publicUrl: '', evidenceReference: '', confirmation: '' }
  }

  async function recordReceipt(listing: Listing) {
    const draft = defaultReceiptType(listing)
    const receiptType = listing.status === 'ready' ? 'manual-submission' : listing.status === 'submitted' ? 'publication-confirmation' : 'withdrawal-confirmation'
    setSaving(listing.id); setError(''); setMessage('')
    try {
      const evidence = draft.evidenceReference.trim()
        ? [{ label: 'Operator-supplied real-world action evidence', ...(draft.evidenceReference.startsWith('http') ? { url: draft.evidenceReference } : { reference: draft.evidenceReference }) }]
        : []
      const response = await fetch(`/api/listings/${listing.id}/receipts`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          receiptType,
          externalListingId: draft.externalListingId || undefined,
          publicUrl: draft.publicUrl || undefined,
          evidence,
          operatorConfirmation: draft.confirmation,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record publication receipt.')
      setMessage(`Real-world ${receiptType} receipt recorded. Listing state is now ${payload.data.listing.status}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record publication receipt.')
    } finally { setSaving('') }
  }

  const channelById = new Map(channels.map((channel) => [channel.id, channel]))
  const productById = new Map(products.map((product) => [product.id, product]))

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Distribution Operations</p><h1 className="mt-3 font-display text-5xl uppercase">LAUNCH BAY</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Evidence-backed channel registry, manual listing packages and real-world publication receipts. C0 is research-only; C1 prepares manual packages. C2–C4 remain disabled.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <section className="grid gap-3 md:grid-cols-3">{[['C0','Research only'],['C1','Manual listing package only'],['C2–C4','Disabled until official permission and tested integration']].map(([level,description]) => <div key={level} className="border border-acid-lime/20 p-4"><p className="font-mono text-xs text-acid-lime">{level}</p><p className="mt-2 text-sm">{description}</p></div>)}</section>
    <section className="space-y-4"><div><h2 className="font-display text-2xl uppercase">Channel registry</h2><p className="text-xs text-muted-ink">No channel is pre-seeded. Register only channels with source evidence you have actually reviewed.</p></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading channel records…</p> : channels.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No channel accounts are registered. No marketplace eligibility or payout setup is assumed.</p> : <div className="grid gap-3 md:grid-cols-2">{channels.map((channel) => {
        const draft = channelDrafts[channel.id]
        return <article key={channel.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-display text-xl uppercase">{channel.displayName}</h3><p className="font-mono text-[10px] text-muted-ink">{channel.channelKey} · {channel.countryCode} · revision {channel.revision}</p></div><span className="border border-acid-lime/30 px-2 py-1 font-mono text-[10px] uppercase">{channel.capability}</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs"><p>Account: <strong>{channel.accountEligibility}</strong></p><p>Payout: <strong>{channel.payoutSetupStatus}</strong></p><p>Channel: <strong>{channel.channelStatus}</strong></p><p>Policy recheck: <strong>{channel.policyRecheckAt?.slice(0,10) ?? 'not set'}</strong></p></div>
          <details className="border-t border-acid-lime/10 pt-2"><summary className="cursor-pointer font-mono text-[10px] uppercase text-acid-lime">Evidence history · {(channelEvidence[channel.id] ?? []).length} records</summary><div className="mt-3 space-y-2">{(channelEvidence[channel.id] ?? []).map((item) => <div key={item.id} className="border-l border-acid-lime/30 pl-3 text-xs"><p className="font-mono">{item.evidenceType} · {item.evidenceClass}</p><a className="break-all text-acid-lime underline" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceUrl}</a><p className="mt-1">{item.summary}</p><p className="text-muted-ink">Captured {new Date(item.capturedAt).toLocaleString()} · {item.limitations}</p></div>)}</div></details>
          {draft && <details className="border-t border-acid-lime/10 pt-2"><summary className="cursor-pointer font-mono text-[10px] uppercase text-acid-lime">Update eligibility / capability</summary><div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-[10px] font-mono uppercase">Capability<select value={draft.capability} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, capability: event.target.value as ChannelDraft['capability'] } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="C0">C0 · Research only</option><option value="C1">C1 · Manual package</option></select></label>
            <label className="text-[10px] font-mono uppercase">Account eligibility<select value={draft.accountEligibility} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, accountEligibility: event.target.value as ChannelDraft['accountEligibility'] } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="unknown">Unknown</option><option value="eligible">Eligible · evidence required</option><option value="ineligible">Ineligible</option></select></label>
            <label className="text-[10px] font-mono uppercase">Payout setup<select value={draft.payoutSetupStatus} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, payoutSetupStatus: event.target.value as ChannelDraft['payoutSetupStatus'] } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="unknown">Unknown</option><option value="not-configured">Not configured</option><option value="configured">Configured · evidence required</option><option value="unavailable">Unavailable</option></select></label>
            <label className="text-[10px] font-mono uppercase">Country<input value={draft.countryCode} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, countryCode: event.target.value.toUpperCase() } }))} maxLength={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Official policy URL<input value={draft.officialPolicyUrl} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, officialPolicyUrl: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Policy reviewed<input type="date" value={draft.policyReviewedAt} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, policyReviewedAt: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Policy recheck date<input type="date" value={draft.policyRecheckAt} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, policyRecheckAt: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Payout requirements JSON<textarea value={draft.payoutRequirements} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, payoutRequirements: event.target.value } }))} rows={3} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Granted scopes (comma-separated)<textarea value={draft.grantedScopes} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, grantedScopes: event.target.value } }))} rows={3} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Quota notes JSON<textarea value={draft.quotaNotes} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, quotaNotes: event.target.value } }))} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Channel status<select value={draft.channelStatus} onChange={(event) => setChannelDrafts((current) => ({ ...current, [channel.id]: { ...draft, channelStatus: event.target.value as ChannelDraft['channelStatus'] } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="active">Active</option><option value="paused">Paused</option></select></label>
            <button type="button" disabled={saving === channel.id} onClick={() => void updateChannel(channel)} className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40">{saving === channel.id ? 'Saving…' : 'Save channel revision'}</button>
            <p className="text-[10px] text-muted-ink md:col-span-2">Existing evidence is retained and included in each revision. Add new source evidence through the registry API; do not store bank account numbers, passwords, API keys or recovery codes here.</p>
          </div></details>}
        </article>
      })}</div>}
    </section>
    <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Register a channel</h2><p className="text-xs text-muted-ink">C1 requires official policy, account eligibility and payout evidence. No channel is seeded or assumed eligible.</p></div>
      <form onSubmit={createChannel} className="grid gap-3 border border-acid-lime/20 bg-panel-charcoal p-4 md:grid-cols-2">
        <label className="text-[10px] font-mono uppercase">Channel key<input required value={channelForm.channelKey} onChange={(event) => setChannelForm({ ...channelForm, channelKey: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="example-market" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Display name<input required value={channelForm.displayName} onChange={(event) => setChannelForm({ ...channelForm, displayName: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Country code<input required value={channelForm.countryCode} onChange={(event) => setChannelForm({ ...channelForm, countryCode: event.target.value.toUpperCase() })} maxLength={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Capability<select value={channelForm.capability} onChange={(event) => setChannelForm({ ...channelForm, capability: event.target.value as Channel['capability'] })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="C0">C0 · Research only</option><option value="C1">C1 · Manual package</option></select></label>
        <label className="text-[10px] font-mono uppercase">Account eligibility<select value={channelForm.accountEligibility} onChange={(event) => setChannelForm({ ...channelForm, accountEligibility: event.target.value as Channel['accountEligibility'] })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="unknown">Unknown</option><option value="eligible">Eligible · evidence required</option><option value="ineligible">Ineligible</option></select></label>
        <label className="text-[10px] font-mono uppercase">Payout setup<select value={channelForm.payoutSetupStatus} onChange={(event) => setChannelForm({ ...channelForm, payoutSetupStatus: event.target.value as Channel['payoutSetupStatus'] })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="unknown">Unknown</option><option value="not-configured">Not configured</option><option value="configured">Configured · evidence required</option><option value="unavailable">Unavailable</option></select></label>
        <label className="text-[10px] font-mono uppercase md:col-span-2">Official policy URL<input type="url" value={channelForm.officialPolicyUrl} onChange={(event) => setChannelForm({ ...channelForm, officialPolicyUrl: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Policy reviewed<input type="date" value={channelForm.policyReviewedAt} onChange={(event) => setChannelForm({ ...channelForm, policyReviewedAt: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Policy recheck date<input type="date" value={channelForm.policyRecheckAt} onChange={(event) => setChannelForm({ ...channelForm, policyRecheckAt: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Policy evidence summary<input value={channelForm.policySummary} onChange={(event) => setChannelForm({ ...channelForm, policySummary: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Account eligibility evidence URL<input type="url" value={channelForm.accountEvidenceUrl} onChange={(event) => setChannelForm({ ...channelForm, accountEvidenceUrl: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Payout setup evidence URL<input type="url" value={channelForm.payoutEvidenceUrl} onChange={(event) => setChannelForm({ ...channelForm, payoutEvidenceUrl: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Payout requirements JSON<textarea value={channelForm.payoutRequirements} onChange={(event) => setChannelForm({ ...channelForm, payoutRequirements: event.target.value })} rows={3} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Granted scopes (comma-separated)<input value={channelForm.grantedScopes} onChange={(event) => setChannelForm({ ...channelForm, grantedScopes: event.target.value })} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono text-muted-ink uppercase md:col-span-2">Quota notes JSON<textarea value={channelForm.quotaNotes} onChange={(event) => setChannelForm({ ...channelForm, quotaNotes: event.target.value })} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
        <button type="submit" disabled={saving === 'channel'} className="bg-acid-lime px-4 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-40 md:col-span-2">{saving === 'channel' ? 'Registering…' : 'Register evidence-backed channel'}</button>
      </form>
    </section>
    <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Manual listing packages</h2><p className="text-xs text-muted-ink">Package generation never publishes. Readiness gates are evaluated from persisted product, asset, channel and evidence records.</p></div>
      {!loading && products.length === 0 && <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No product versions are available yet.</p>}
      {products.map((product) => {
        const draft = listingDrafts[product.id] ?? { channelId: '', disclosure: '' }
        return <article key={product.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display text-xl uppercase">{product.title}</h3><p className="text-xs text-muted-ink">{product.productFamily} · v{product.version} · {product.lifecycleState}</p></div></div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-[10px] font-mono uppercase">Channel<select value={draft.channelId} onChange={(event) => setListingDrafts((current) => ({ ...current, [product.id]: { ...draft, channelId: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="">Select a registered channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName} · {channel.capability} · {channel.channelStatus}</option>)}</select></label>
            <label className="text-[10px] font-mono uppercase">Listing disclosure<textarea value={draft.disclosure} onChange={(event) => setListingDrafts((current) => ({ ...current, [product.id]: { ...draft, disclosure: event.target.value } }))} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" placeholder="Disclose AI assistance, licenses, limitations or other channel-required statements." /></label>
          </div>
          <button type="button" disabled={saving === product.id || !draft.channelId || draft.disclosure.trim().length < 10} onClick={() => void createPackage(product)} className="border border-acid-lime/40 px-4 py-2 font-mono text-[10px] uppercase disabled:opacity-40">{saving === product.id ? 'Generating…' : 'Generate manual listing package'}</button>
        </article>
      })}
    </section>
    <section className="space-y-3"><div><h2 className="font-display text-2xl uppercase">Listing ledger</h2><p className="text-xs text-muted-ink">Submission, publication and withdrawal states require explicit evidence receipts.</p></div>
      {!loading && listings.length === 0 && <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No listing packages have been generated.</p>}
      {listings.map((listing) => {
        const product = productById.get(listing.productId)
        const channel = channelById.get(listing.channelId)
        const draft = defaultReceiptType(listing)
        const receiptType = listing.status === 'ready' ? 'manual-submission' : listing.status === 'submitted' ? 'publication-confirmation' : 'withdrawal-confirmation'
        const canRecord = ['ready', 'submitted', 'published'].includes(listing.status)
        return <article key={listing.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display text-lg uppercase">{product?.title ?? listing.productId}</h3><p className="text-xs text-muted-ink">{channel?.displayName ?? listing.channelId} · v{listing.productVersion} · {new Date(listing.createdAt).toLocaleString()}</p></div><span className="border border-acid-lime/30 px-2 py-1 font-mono text-[10px] uppercase">{listing.status}</span></div>
          <p className="break-all font-mono text-[10px] text-muted-ink">Package SHA-256: {listing.packageHash}</p>
          <div className="grid gap-2 md:grid-cols-2">{listing.readinessSnapshot.gates.map((gate) => <div key={gate.key} className="border border-acid-lime/10 p-2 text-xs"><p className="font-mono uppercase">{gate.key} · <strong className={gate.status === 'pass' ? 'text-acid-lime' : gate.status === 'blocked' ? 'text-red-300' : 'text-orange-200'}>{gate.status}</strong></p><p className="mt-1 text-muted-ink">{gate.rationale}</p></div>)}</div>
          <details className="border-t border-acid-lime/10 pt-2"><summary className="cursor-pointer font-mono text-[10px] uppercase text-acid-lime">View deterministic manual package</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words bg-obsidian p-3 text-[10px]">{JSON.stringify(listing.listingPackage, null, 2)}</pre></details>
          {canRecord && <details className="border-t border-acid-lime/10 pt-2"><summary className="cursor-pointer font-mono text-[10px] uppercase text-acid-lime">Record actual {receiptType.replaceAll('-', ' ')} receipt</summary><div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-[10px] font-mono uppercase">External listing ID<input value={draft.externalListingId} onChange={(event) => setReceiptDrafts((current) => ({ ...current, [listing.id]: { ...draft, externalListingId: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase">Public listing URL (required for publication/withdrawal)<input value={draft.publicUrl} onChange={(event) => setReceiptDrafts((current) => ({ ...current, [listing.id]: { ...draft, publicUrl: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Evidence URL or reference<input value={draft.evidenceReference} onChange={(event) => setReceiptDrafts((current) => ({ ...current, [listing.id]: { ...draft, evidenceReference: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Explicit confirmation<textarea value={draft.confirmation} onChange={(event) => setReceiptDrafts((current) => ({ ...current, [listing.id]: { ...draft, confirmation: event.target.value } }))} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" placeholder="Confirm the real action already occurred. This form does not perform the marketplace action." /></label>
            <button type="button" disabled={saving === listing.id || draft.confirmation.trim().length < 20 || !draft.evidenceReference.trim() || (receiptType !== 'manual-submission' && !draft.publicUrl.trim() && !draft.externalListingId.trim())} onClick={() => void recordReceipt(listing)} className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40 md:col-span-2">{saving === listing.id ? 'Recording…' : 'Record actual channel action'}</button>
          </div></details>}
        </article>
      })}
    </section>
    <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh records</button><p className="self-center text-[10px] text-muted-ink">No scraping, credential sharing, CAPTCHA bypass, unattended publishing or inferred sales is performed.</p></div>
  </div></main>
}
