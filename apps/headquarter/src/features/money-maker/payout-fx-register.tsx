'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Channel = { id: string; displayName: string; capability: string; enabled: boolean }
type Payout = {
  id: string
  channelId: string
  channelName: string
  amountMinor: string
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'reversed' | 'disputed'
  providerReference: string | null
  expectedAt: string | null
  paidAt: string | null
  source: string
  sourceEvidence: { evidenceUrl: string; capturedAt: string; summary: string }
  history: Array<{ fromStatus: string | null; toStatus: string; rationale: string; occurredAt: string }>
  allowedNextStatuses: Array<'paid' | 'failed' | 'reversed' | 'disputed'>
}
type FinancialEvent = {
  id: string
  eventType: string
  amountMinor: string
  currency: string
  reconciliationState: string
  source: string
}
type FxConversion = {
  id: string
  sourceEventId: string
  fromAmountMinor: string
  fromCurrency: string
  toAmountMinor: string
  toCurrency: string
  rateNumerator: string
  rateDenominator: string
  rateSource: string
  sourceUrl: string
  observedAt: string
}
type TransitionDraft = {
  status: 'paid' | 'failed' | 'reversed' | 'disputed'
  rationale: string
  evidenceUrl: string
  capturedAt: string
}

function localDateTime() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function asIso(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text ? new Date(text).toISOString() : undefined
}

export function PayoutFxRegister() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [events, setEvents] = useState<FinancialEvent[]>([])
  const [conversions, setConversions] = useState<FxConversion[]>([])
  const [transitionDrafts, setTransitionDrafts] = useState<Record<string, TransitionDraft>>({})
  const [payoutKey, setPayoutKey] = useState('')
  const [fxKey, setFxKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const responses = await Promise.all([
        fetch('/api/payouts', { cache: 'no-store' }),
        fetch('/api/channels', { cache: 'no-store' }),
        fetch('/api/financial-events', { cache: 'no-store' }),
        fetch('/api/fx-conversions', { cache: 'no-store' }),
      ])
      const payloads = await Promise.all(responses.map((response) => response.json()))
      if (responses.some((response) => response.status === 401)) throw new Error('Operator login required. Sign in at /login.')
      const failed = responses.findIndex((response) => !response.ok)
      if (failed >= 0) throw new Error(payloads[failed].error?.message || 'Unable to load payout and FX records.')
      setPayouts(payloads[0].data ?? [])
      setChannels(payloads[1].data ?? [])
      setEvents(payloads[2].data ?? [])
      setConversions(payloads[3].data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load payout and FX records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function createPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving('payout')
    setError('')
    setMessage('')
    try {
      const key = payoutKey || `manual-payout-${crypto.randomUUID()}`
      setPayoutKey(key)
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channelId: String(data.get('channelId') ?? ''),
          amountMinor: String(data.get('amountMinor') ?? ''),
          currency: String(data.get('currency') ?? '').toUpperCase(),
          expectedAt: asIso(data.get('expectedAt')),
          providerReference: String(data.get('providerReference') ?? '').trim() || undefined,
          source: String(data.get('source') ?? ''),
          idempotencyKey: key,
          evidenceUrl: String(data.get('evidenceUrl') ?? ''),
          evidenceCapturedAt: asIso(data.get('evidenceCapturedAt')),
          evidenceSummary: String(data.get('evidenceSummary') ?? ''),
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record payout.')
      form.reset()
      setPayoutKey('')
      setMessage(payload.replayed ? 'Existing payout returned for this idempotency key.' : 'Payout recorded as pending. No paid status or bank balance is inferred.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record payout.')
    } finally {
      setSaving('')
    }
  }

  async function transitionPayout(payout: Payout) {
    const draft = transitionDrafts[payout.id]
    if (!draft || !draft.rationale.trim() || !draft.evidenceUrl.trim() || !draft.capturedAt) {
      setError('Payout status changes require a rationale, source evidence URL, and evidence capture time.')
      return
    }
    setSaving(payout.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/payouts/${payout.id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: draft.status,
          rationale: draft.rationale,
          evidenceUrl: draft.evidenceUrl,
          evidenceCapturedAt: new Date(draft.capturedAt).toISOString(),
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Payout transition was rejected.')
      setMessage(`Payout ${payout.id} updated to ${draft.status}. Ledger movement was recorded only for paid/reversed status.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update payout status.')
    } finally {
      setSaving('')
    }
  }

  async function createFxConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setSaving('fx')
    setError('')
    setMessage('')
    try {
      const key = fxKey || `manual-fx-${crypto.randomUUID()}`
      setFxKey(key)
      const response = await fetch('/api/fx-conversions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceEventId: String(data.get('sourceEventId') ?? ''),
          fromAmountMinor: String(data.get('fromAmountMinor') ?? ''),
          fromCurrency: String(data.get('fromCurrency') ?? '').toUpperCase(),
          toAmountMinor: String(data.get('toAmountMinor') ?? ''),
          toCurrency: String(data.get('toCurrency') ?? '').toUpperCase(),
          rateNumerator: String(data.get('rateNumerator') ?? ''),
          rateDenominator: String(data.get('rateDenominator') ?? ''),
          rateSource: String(data.get('rateSource') ?? ''),
          sourceUrl: String(data.get('sourceUrl') ?? ''),
          observedAt: asIso(data.get('observedAt')),
          idempotencyKey: key,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record FX conversion.')
      form.reset()
      setFxKey('')
      setMessage(payload.replayed ? 'Existing FX conversion returned for this idempotency key.' : 'FX conversion recorded with its exact rational rate. Original financial event and currency remain unchanged.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record FX conversion.')
    } finally {
      setSaving('')
    }
  }

  const eligibleChannels = channels.filter((channel) => channel.enabled && ['C1', 'C2', 'C3', 'C4'].includes(channel.capability))
  const verifiedEvents = events.filter((item) => item.reconciliationState === 'verified')

  return <div className="space-y-8">
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/40 p-4 text-sm">{message}</div>}

    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div><h2 className="font-display text-2xl uppercase">Payout register</h2><p className="text-xs text-muted-ink">Payout lifecycle is separate from net contribution and bank balance. Status changes require source evidence.</p></div>
        <button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button>
      </div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading payout records…</p>
        : payouts.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No payout records. Pending or paid amounts are never inferred from channel estimates.</p>
        : <div className="space-y-3">{payouts.map((payout) => {
          const draft = transitionDrafts[payout.id] ?? {
            status: payout.allowedNextStatuses[0] ?? 'paid',
            rationale: '',
            evidenceUrl: '',
            capturedAt: localDateTime(),
          }
          return <article key={payout.id} className="space-y-3 border border-acid-lime/20 bg-panel-charcoal p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-display text-lg uppercase">{payout.channelName}</h3><p className="text-xs text-muted-ink">{payout.source} · {payout.providerReference || 'No provider reference'}</p><p className="break-all text-[10px] text-muted-ink">{payout.id}</p></div>
              <div className="text-right"><p className="font-mono text-lg">{payout.currency} {payout.amountMinor}</p><p className="font-mono text-[10px] uppercase text-acid-lime">{payout.status}</p></div>
            </div>
            <p className="text-xs text-muted-ink">Source: <a className="underline" href={payout.sourceEvidence.evidenceUrl} target="_blank" rel="noreferrer">open evidence</a> · captured {new Date(payout.sourceEvidence.capturedAt).toLocaleString()}</p>
            <ol className="space-y-1 border-l border-acid-lime/30 pl-3 text-xs text-muted-ink">{payout.history.map((item, index) => <li key={index}><strong className="text-paper-bone">{item.fromStatus ?? 'new'} → {item.toStatus}</strong> · {item.rationale}</li>)}</ol>
            {payout.allowedNextStatuses.length > 0 && <div className="grid gap-2 border-t border-acid-lime/20 pt-3 md:grid-cols-2">
              <label className="text-xs font-mono uppercase">Next status<select value={draft.status} onChange={(event) => setTransitionDrafts((current) => ({ ...current, [payout.id]: { ...draft, status: event.target.value as TransitionDraft['status'] } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs">{payout.allowedNextStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              <label className="text-xs font-mono uppercase">Evidence captured at<input type="datetime-local" value={draft.capturedAt} onChange={(event) => setTransitionDrafts((current) => ({ ...current, [payout.id]: { ...draft, capturedAt: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
              <label className="text-xs font-mono uppercase md:col-span-2">Evidence URL<input type="url" value={draft.evidenceUrl} onChange={(event) => setTransitionDrafts((current) => ({ ...current, [payout.id]: { ...draft, evidenceUrl: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
              <label className="text-xs font-mono uppercase md:col-span-2">Rationale<textarea rows={2} value={draft.rationale} onChange={(event) => setTransitionDrafts((current) => ({ ...current, [payout.id]: { ...draft, rationale: event.target.value } }))} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs" /></label>
              <button type="button" disabled={saving === payout.id} onClick={() => void transitionPayout(payout)} className="border border-acid-lime px-4 py-2 font-mono text-xs uppercase disabled:opacity-50 md:col-span-2">{saving === payout.id ? 'Saving…' : `Apply ${draft.status} transition`}</button>
            </div>}
          </article>
        })}</div>}
    </section>

    <form onSubmit={createPayout} className="space-y-4 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7">
      <div><h2 className="font-display text-xl uppercase">Record expected payout</h2><p className="text-xs text-muted-ink">Only reviewed, enabled C1+ channels are selectable. This creates a pending record, not proof of payment.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-mono uppercase">Channel<select name="channelId" required disabled={eligibleChannels.length === 0} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="">Select reviewed channel</option>{eligibleChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName} · {channel.capability}</option>)}</select></label>
        <label className="text-xs font-mono uppercase">Amount · minor units<input name="amountMinor" required pattern="[1-9][0-9]{0,17}" inputMode="numeric" placeholder="50000" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="IDR" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm uppercase" /></label>
        <label className="text-xs font-mono uppercase">Expected at (optional)<input name="expectedAt" type="datetime-local" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Source<input name="source" required minLength={2} maxLength={200} placeholder="Provider statement / payout notice" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Provider reference<input name="providerReference" maxLength={300} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase md:col-span-2">Source evidence URL<input name="evidenceUrl" type="url" required className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Evidence captured at<input name="evidenceCapturedAt" type="datetime-local" required defaultValue={localDateTime()} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase md:col-span-2">Evidence summary<textarea name="evidenceSummary" required minLength={10} maxLength={2000} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
      </div>
      {eligibleChannels.length === 0 && <p className="text-xs text-muted-ink">No eligible channel is configured. Review a channel in LAUNCH BAY first.</p>}
      <button type="submit" disabled={saving === 'payout' || eligibleChannels.length === 0} className="border border-acid-lime bg-acid-lime px-5 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving === 'payout' ? 'Recording…' : 'Record pending payout'}</button>
    </form>

    <section className="space-y-3">
      <div><h2 className="font-display text-xl uppercase">FX conversion records</h2><p className="text-xs text-muted-ink">Manual, source-backed conversions only. Rate is an exact rational number of target minor units per source minor unit; half-up integer rounding is enforced. Original events and currency summaries remain unchanged.</p></div>
      {conversions.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-4 text-sm text-muted-ink">No FX conversions recorded.</p> : <div className="space-y-2">{conversions.map((conversion) => <article key={conversion.id} className="border border-acid-lime/20 p-3 text-xs"><p className="font-mono">{conversion.fromCurrency} {conversion.fromAmountMinor} → {conversion.toCurrency} {conversion.toAmountMinor}</p><p className="text-muted-ink">Rate {conversion.rateNumerator}/{conversion.rateDenominator} · {conversion.rateSource} · {new Date(conversion.observedAt).toLocaleString()}</p><a className="underline text-muted-ink" href={conversion.sourceUrl} target="_blank" rel="noreferrer">Open rate evidence</a></article>)}</div>}
    </section>

    <form onSubmit={createFxConversion} className="space-y-4 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7">
      <div><h2 className="font-display text-xl uppercase">Record manual FX conversion</h2><p className="text-xs text-muted-ink">Select a verified source event. This stores a conversion record for reporting; it does not rewrite the source event or combine currency totals.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-mono uppercase md:col-span-2">Verified source event<select name="sourceEventId" required className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-xs"><option value="">Select verified event</option>{verifiedEvents.map((item) => <option key={item.id} value={item.id}>{item.eventType} · {item.currency} {item.amountMinor} · {item.id}</option>)}</select></label>
        <label className="text-xs font-mono uppercase">From amount · minor units<input name="fromAmountMinor" required pattern="[1-9][0-9]{0,17}" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">From currency<input name="fromCurrency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="IDR" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm uppercase" /></label>
        <label className="text-xs font-mono uppercase">To amount · minor units<input name="toAmountMinor" required pattern="[1-9][0-9]{0,17}" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">To currency<input name="toCurrency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="USD" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm uppercase" /></label>
        <label className="text-xs font-mono uppercase">Rate numerator<input name="rateNumerator" required pattern="[1-9][0-9]{0,37}" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Rate denominator<input name="rateDenominator" required pattern="[1-9][0-9]{0,37}" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Rate source<input name="rateSource" required minLength={2} maxLength={200} placeholder="Bank statement / official rate" className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase">Observed at<input name="observedAt" type="datetime-local" required defaultValue={localDateTime()} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="text-xs font-mono uppercase md:col-span-2">Rate evidence URL<input name="sourceUrl" type="url" required className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
      </div>
      {verifiedEvents.length === 0 && <p className="text-xs text-muted-ink">FX conversion is unavailable until a source financial event is reconciled as verified.</p>}
      <button type="submit" disabled={saving === 'fx' || verifiedEvents.length === 0} className="border border-acid-lime bg-acid-lime px-5 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving === 'fx' ? 'Recording…' : 'Record exact FX conversion'}</button>
    </form>
  </div>
}
