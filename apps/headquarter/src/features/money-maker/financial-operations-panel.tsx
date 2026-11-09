'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'

export type FinancialEventRecord = {
  id: string
  productId: string | null
  eventType: string
  amountMinor: string
  currency: string
  occurredAt: string
  recordedAt: string
  source: string
  providerReference: string | null
  reconciliationState: 'pending' | 'verified' | 'disputed' | 'reversed'
  metadata: Record<string, unknown>
}

export type PayoutRecord = {
  id: string
  channelId: string | null
  channelName: string
  amountMinor: string
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'reversed' | 'disputed'
  providerReference: string | null
  expectedAt: string | null
  paidAt: string | null
  source: string
  sourceEvidence: { evidenceUrl: string; capturedAt: string; summary: string }
  reconciliationEvidence: Record<string, unknown>
  createdAt: string
  recordedAt: string
  updatedAt: string
  history: Array<{
    fromStatus?: string | null
    toStatus?: string
    rationale?: string
    occurredAt?: string
    recordedAt?: string
    evidence?: { evidenceUrl?: string; capturedAt?: string; summary?: string; rationale?: string }
  }>
  allowedNextStatuses: Array<'paid' | 'failed' | 'reversed' | 'disputed'>
}

export type FxConversionRecord = {
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
  recordedAt: string
}

export type PayoutChannelOption = {
  id: string
  displayName: string
  capability: string
  channelStatus: string
  accountEligibility: string
  payoutSetupStatus: string
  officialPolicyUrl: string | null
  policyReviewedAt: string | null
  policyRecheckAt: string | null
}

export type FinancialSummaryRow = {
  currency: string
  gross_receipts_minor: string
  deductions_minor: string
  tax_reserve_minor: string
  payout_movements_minor: string
  pending_minor: string
  pending_count: string
  net_contribution_minor: string
}

type ProductOption = { id: string; title: string }

type Props = {
  products: ProductOption[]
  channels: PayoutChannelOption[]
  financialEvents: FinancialEventRecord[]
  payouts: PayoutRecord[]
  fxConversions: FxConversionRecord[]
  financialSummary: FinancialSummaryRow[]
  onRefresh: () => Promise<void>
  onError: (value: string) => void
  onNotice: (value: string) => void
}

const eventTypes = [
  'gross-receipt',
  'platform-fee',
  'refund',
  'chargeback',
  'variable-cost',
  'production-cost',
  'tax-reserve',
] as const

function nowLocalInput(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function toIso(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error('Enter a valid date and time with a known local timezone.')
  return parsed.toISOString()
}

function minor(value: string, currency: string): string {
  return value + ' ' + currency + ' minor units'
}

function exactConvertedMinor(amount: string, numerator: string, denominator: string): string | null {
  try {
    const base = BigInt(amount)
    const top = BigInt(numerator)
    const bottom = BigInt(denominator)
    if (base <= 0n || top <= 0n || bottom <= 0n) return null
    return ((base * top + bottom / 2n) / bottom).toString()
  } catch {
    return null
  }
}

async function send(path: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 409) throw new Error(payload.error?.message ?? 'The persisted record changed or failed an ARSY policy check. Refresh and review it.')
    throw new Error(payload.error?.message ?? 'The financial operation was rejected.')
  }
  return payload.data
}

export function FinancialOperationsPanel(props: Props) {
  const {
    products, channels, financialEvents, payouts, fxConversions, financialSummary,
    onRefresh, onError, onNotice,
  } = props
  const summaryRows = Array.isArray(financialSummary) ? financialSummary : []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>MIZAN · Currency-separated ledger</CardTitle>
          <CardDescription>
            Verified amounts stay in their original currency. Values below are integer minor units; no cross-currency total is inferred.
            This workspace records evidence and reconciliation only. It never sends a payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryRows.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">No reconciled balances yet. Pending entries remain separate from verified totals.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summaryRows.map((row) => (
                <article key={row.currency} className="space-y-3 rounded border border-border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{row.currency}</h3>
                    <Badge variant="outline">One currency only</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <dt className="text-muted-foreground">Gross receipts</dt><dd className="text-right tabular-nums">{row.gross_receipts_minor}</dd>
                    <dt className="text-muted-foreground">Deductions</dt><dd className="text-right tabular-nums">{row.deductions_minor}</dd>
                    <dt className="text-muted-foreground">Net contribution</dt><dd className="text-right font-semibold tabular-nums">{row.net_contribution_minor}</dd>
                    <dt className="text-muted-foreground">Tax reserve</dt><dd className="text-right tabular-nums">{row.tax_reserve_minor}</dd>
                    <dt className="text-muted-foreground">Payout movements</dt><dd className="text-right tabular-nums">{row.payout_movements_minor}</dd>
                    <dt className="text-muted-foreground">Pending</dt><dd className="text-right tabular-nums">{row.pending_minor} ({row.pending_count})</dd>
                  </dl>
                  <p className="text-[11px] text-muted-foreground">All figures are minor units for {row.currency}; no FX aggregation is applied here.</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record a financial event</CardTitle>
            <CardDescription>New entries start pending. Only an evidence-backed reconciliation can include them in verified summary totals.</CardDescription>
          </CardHeader>
          <CardContent>
            <FinancialEventCaptureForm products={products} onRefresh={onRefresh} onError={onError} onNotice={onNotice} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verified event → FX record</CardTitle>
            <CardDescription>Choose a verified source event and record the observed rational rate. This stores conversion provenance; it does not rewrite the original event or fetch a quote.</CardDescription>
          </CardHeader>
          <CardContent>
            <FxConversionForm financialEvents={financialEvents} onRefresh={onRefresh} onError={onError} onNotice={onNotice} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial event evidence queue</CardTitle>
          <CardDescription>Pending records need a human decision. Verified, disputed and reversed entries are immutable through this pending-only reconciliation action.</CardDescription>
        </CardHeader>
        <CardContent>
          {financialEvents.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">No financial events have been recorded.</p>
          ) : (
            <div className="space-y-3">
              {financialEvents.map((event) => (
                <article data-testid="financial-event-item" data-reconciliation-state={event.reconciliationState} key={event.id} className="space-y-3 rounded border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-semibold">{event.eventType} · {minor(event.amountMinor, event.currency)}</h3>
                      <p className="text-xs text-muted-foreground">{event.source} · occurred {new Date(event.occurredAt).toLocaleString()}</p>
                      <p className="break-all text-[11px] text-muted-foreground">Reference: {event.providerReference ?? 'not supplied'} · recorded {new Date(event.recordedAt).toLocaleString()}</p>
                    </div>
                    <Badge variant="outline">{event.reconciliationState}</Badge>
                  </div>
                  {event.reconciliationState === 'pending' && (
                    <EventReconciliationForm event={event} onRefresh={onRefresh} onError={onError} onNotice={onNotice} />
                  )}
                  {Boolean(event.metadata?.reconciliation)
                    && typeof event.metadata.reconciliation === 'object'
                    && event.metadata.reconciliation !== null && (
                    <p className="text-xs text-muted-foreground">Reconciliation: {typeof (event.metadata.reconciliation as Record<string, unknown>).rationale === 'string' ? (event.metadata.reconciliation as Record<string, string>).rationale : 'Evidence attached'}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual payout register</CardTitle>
          <CardDescription>Pending payout records are not proof of cash movement. Paid/reversed ledger events are created only after the operator records a supported statement transition.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PayoutCreateForm channels={channels} onRefresh={onRefresh} onError={onError} onNotice={onNotice} />
          {payouts.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">No payout statements are registered.</p>
          ) : (
            <div className="space-y-3">
              {payouts.map((payout) => (
                <article key={payout.id} className="space-y-3 rounded border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{minor(payout.amountMinor, payout.currency)} · {payout.channelName}</h3>
                      <p className="text-xs text-muted-foreground">{payout.source} · {payout.providerReference ?? 'no provider reference'}</p>
                      <p className="text-[11px] text-muted-foreground">Recorded {new Date(payout.recordedAt).toLocaleString()} · paidAt {payout.paidAt ? new Date(payout.paidAt).toLocaleString() : 'not recorded'}</p>
                    </div>
                    <Badge variant="outline">{payout.status}</Badge>
                  </div>
                  <div className="rounded bg-muted/50 p-3 text-xs">
                    <p className="font-medium">Initial evidence</p>
                    <a className="break-all underline" href={payout.sourceEvidence.evidenceUrl} target="_blank" rel="noreferrer">{payout.sourceEvidence.evidenceUrl}</a>
                    <p className="mt-1 text-muted-foreground">{payout.sourceEvidence.summary}</p>
                  </div>
                  {payout.history.length > 0 && (
                    <ol className="space-y-2 border-l border-border pl-3 text-xs">
                      {payout.history.map((entry, index) => (
                        <li key={payout.id + '-' + index} className="space-y-1">
                          <p className="font-medium">{entry.fromStatus ?? 'new'} → {entry.toStatus ?? 'unknown'}</p>
                          <p className="text-muted-foreground">Occurred {entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : 'not supplied'} · recorded {entry.recordedAt ? new Date(entry.recordedAt).toLocaleString() : 'legacy event'}</p>
                          {entry.rationale && <p>{entry.rationale}</p>}
                          {entry.evidence?.evidenceUrl && <a className="break-all underline" href={entry.evidence.evidenceUrl} target="_blank" rel="noreferrer">{entry.evidence.evidenceUrl}</a>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {payout.allowedNextStatuses.length > 0 ? (
                    <PayoutTransitionForm payout={payout} onRefresh={onRefresh} onError={onError} onNotice={onNotice} />
                  ) : (
                    <p className="text-xs text-muted-foreground">No further status transition is allowed for this payout state.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>FX conversion provenance</CardTitle>
          <CardDescription>Exact minor-unit conversions with source, observed time and rational numerator/denominator.</CardDescription>
        </CardHeader>
        <CardContent>
          {fxConversions.length === 0 ? (
            <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">No FX conversion evidence is recorded.</p>
          ) : (
            <div className="space-y-2">
              {fxConversions.map((conversion) => (
                <article key={conversion.id} className="space-y-1 rounded border border-border p-3 text-xs">
                  <p className="font-semibold">{minor(conversion.fromAmountMinor, conversion.fromCurrency)} → {minor(conversion.toAmountMinor, conversion.toCurrency)}</p>
                  <p>Rate {conversion.rateNumerator}/{conversion.rateDenominator} · {conversion.rateSource}</p>
                  <a className="break-all underline" href={conversion.sourceUrl} target="_blank" rel="noreferrer">{conversion.sourceUrl}</a>
                  <p className="text-muted-foreground">Observed {new Date(conversion.observedAt).toLocaleString()} · recorded {new Date(conversion.recordedAt).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FinancialEventCaptureForm({
  products, onRefresh, onError, onNotice,
}: Pick<Props, 'products' | 'onRefresh' | 'onError' | 'onNotice'>) {
  const [productId, setProductId] = useState('')
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>('gross-receipt')
  const [amountMinor, setAmountMinor] = useState('')
  const [currency, setCurrency] = useState('IDR')
  const [occurredAt, setOccurredAt] = useState(nowLocalInput)
  const [source, setSource] = useState('Manual statement reconciliation')
  const [providerReference, setProviderReference] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); onError(''); onNotice('')
    try {
      await send('/api/money-maker/financial-events', 'POST', {
        ...(productId ? { productId } : {}),
        eventType, amountMinor, currency: currency.toUpperCase(), occurredAt: toIso(occurredAt),
        source, ...(providerReference.trim() ? { providerReference: providerReference.trim() } : {}),
        idempotencyKey: 'hq-financial-event-' + crypto.randomUUID(),
      })
      setAmountMinor(''); setProviderReference('')
      onNotice('Financial event recorded as pending. It is excluded from verified summary totals until reconciled.')
      await onRefresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to record financial event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="financial-event-form" onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-xs font-medium">Event type
        <select data-testid="financial-event-type" required value={eventType} onChange={(event) => setEventType(event.target.value as (typeof eventTypes)[number])} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
          {eventTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs font-medium">Product (optional)
        <select value={productId} onChange={(event) => setProductId(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
          <option value="">No product link</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs font-medium">Amount in minor units
          <input required inputMode="numeric" pattern="[1-9][0-9]{0,17}" value={amountMinor} onChange={(event) => setAmountMinor(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Currency
          <input required minLength={3} maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="w-full rounded border border-input bg-background px-3 py-2 text-sm uppercase" />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium">Event occurred at
        <input required type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium">Source
        <input required minLength={2} maxLength={200} value={source} onChange={(event) => setSource(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium">Provider reference (optional)
        <input maxLength={300} value={providerReference} onChange={(event) => setProviderReference(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Recording…' : 'Record pending event'}</button>
    </form>
  )
}

function EventReconciliationForm({
  event, onRefresh, onError, onNotice,
}: { event: FinancialEventRecord } & Pick<Props, 'onRefresh' | 'onError' | 'onNotice'>) {
  const [state, setState] = useState<'verified' | 'disputed' | 'reversed'>('verified')
  const [rationale, setRationale] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault()
    setSaving(true); onError(''); onNotice('')
    try {
      await send('/api/money-maker/financial-events/' + encodeURIComponent(event.id) + '/reconciliation', 'PATCH', {
        state, rationale, evidenceUrl,
      })
      onNotice('Financial event reconciliation saved as ' + state + '.')
      await onRefresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to reconcile financial event.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="event-reconciliation-form" onSubmit={submit} className="grid gap-3 rounded bg-muted/40 p-3 md:grid-cols-[minmax(130px,0.4fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
      <label className="block space-y-1 text-xs font-medium">Reconciliation result
        <select data-testid="event-reconciliation-result" value={state} onChange={(event) => setState(event.target.value as typeof state)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm">
          <option value="verified">verified</option><option value="disputed">disputed</option><option value="reversed">reversed</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs font-medium">Rationale
        <input required minLength={10} maxLength={2000} value={rationale} onChange={(event) => setRationale(event.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium">Evidence URL
        <input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" />
      </label>
      <button type="submit" disabled={saving} className="rounded border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save reconciliation'}</button>
    </form>
  )
}

function PayoutCreateForm({
  channels, onRefresh, onError, onNotice,
}: Pick<Props, 'channels' | 'onRefresh' | 'onError' | 'onNotice'>) {
  const candidates = useMemo(() => channels.filter((channel) =>
    channel.channelStatus === 'active' && channel.capability === 'C1'
    && channel.accountEligibility === 'eligible' && channel.payoutSetupStatus === 'configured'
    && Boolean(channel.officialPolicyUrl && channel.policyReviewedAt && channel.policyRecheckAt)
  ), [channels])
  const [channelId, setChannelId] = useState('')
  const [amountMinor, setAmountMinor] = useState('')
  const [currency, setCurrency] = useState('IDR')
  const [expectedAt, setExpectedAt] = useState('')
  const [providerReference, setProviderReference] = useState('')
  const [source, setSource] = useState('Manual payout statement')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceCapturedAt, setEvidenceCapturedAt] = useState(nowLocalInput)
  const [evidenceSummary, setEvidenceSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedChannelId = channelId || candidates[0]?.id || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedChannelId) { onError('No channel candidate is currently eligible. Review the channel policy and payout evidence first.'); return }
    const selectedChannel = candidates.find((channel) => channel.id === selectedChannelId)
    if (!selectedChannel?.policyRecheckAt || Date.parse(selectedChannel.policyRecheckAt) <= Date.now()) {
      onError('This channel policy evidence has expired. Refresh the workspace and review current source evidence before recording a payout.')
      return
    }
    setSaving(true); onError(''); onNotice('')
    try {
      await send('/api/money-maker/payouts', 'POST', {
        channelId: selectedChannelId, amountMinor, currency: currency.toUpperCase(),
        ...(expectedAt ? { expectedAt: toIso(expectedAt) } : {}),
        ...(providerReference.trim() ? { providerReference: providerReference.trim() } : {}),
        source, idempotencyKey: 'hq-payout-' + crypto.randomUUID(), evidenceUrl,
        evidenceCapturedAt: toIso(evidenceCapturedAt), evidenceSummary,
      })
      setAmountMinor(''); setProviderReference(''); setEvidenceSummary('')
      onNotice('Payout recorded as pending. No transfer was initiated; the record now awaits statement reconciliation.')
      await onRefresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to record payout.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="payout-create-form" onSubmit={submit} className="space-y-3 rounded border border-border p-4">
      <h3 className="text-sm font-semibold">Register a payout statement</h3>
      {candidates.length === 0 && <p className="text-xs text-muted-foreground">No channel currently meets the visible C1/account/policy checks. ARSY also requires four current observed-fact evidence records before accepting a payout.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1 text-xs font-medium">Payout channel
          <select required disabled={candidates.length === 0} value={selectedChannelId} onChange={(event) => setChannelId(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
            {candidates.map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-medium">Amount in minor units
          <input required inputMode="numeric" pattern="[1-9][0-9]{0,17}" value={amountMinor} onChange={(event) => setAmountMinor(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Currency
          <input required minLength={3} maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="w-full rounded border border-input bg-background px-3 py-2 text-sm uppercase" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Expected payout time (optional)
          <input type="datetime-local" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Provider reference (optional)
          <input maxLength={300} value={providerReference} onChange={(event) => setProviderReference(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Source
          <input required minLength={2} maxLength={200} value={source} onChange={(event) => setSource(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1 text-xs font-medium">Initial statement evidence URL
          <input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1 text-xs font-medium">Evidence captured at
          <input required type="datetime-local" value={evidenceCapturedAt} onChange={(event) => setEvidenceCapturedAt(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium">Evidence summary
        <textarea required minLength={10} maxLength={2000} value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={saving || candidates.length === 0} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Recording…' : 'Record pending payout'}</button>
    </form>
  )
}

function PayoutTransitionForm({
  payout, onRefresh, onError, onNotice,
}: { payout: PayoutRecord } & Pick<Props, 'onRefresh' | 'onError' | 'onNotice'>) {
  const [status, setStatus] = useState(payout.allowedNextStatuses[0] ?? 'disputed')
  const [rationale, setRationale] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceCapturedAt, setEvidenceCapturedAt] = useState(nowLocalInput)
  const [occurredAt, setOccurredAt] = useState(nowLocalInput)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!payout.allowedNextStatuses.includes(status)) { onError('ARSY does not currently allow that transition. Refresh the payout before continuing.'); return }
    setSaving(true); onError(''); onNotice('')
    try {
      await send('/api/money-maker/payouts/' + encodeURIComponent(payout.id) + '/status', 'PATCH', {
        status, rationale, evidenceUrl, evidenceCapturedAt: toIso(evidenceCapturedAt), occurredAt: toIso(occurredAt),
      })
      onNotice('Payout status saved as ' + status + '. The ledger records occurredAt separately from the database recordedAt.')
      await onRefresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to reconcile payout.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded bg-muted/40 p-3 md:grid-cols-2">
      <label className="block space-y-1 text-xs font-medium">Next allowed status
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm">
          {payout.allowedNextStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block space-y-1 text-xs font-medium">Statement event occurred at
        <input required type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium">Evidence captured at
        <input required type="datetime-local" value={evidenceCapturedAt} onChange={(event) => setEvidenceCapturedAt(event.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium">Statement evidence URL
        <input required type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-sm" />
      </label>
      <label className="block space-y-1 text-xs font-medium md:col-span-2">Reconciliation rationale
        <textarea required minLength={10} maxLength={2000} value={rationale} onChange={(event) => setRationale(event.target.value)} className="min-h-16 w-full rounded border border-input bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={saving} className="justify-self-start rounded border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save payout transition'}</button>
    </form>
  )
}

function FxConversionForm({
  financialEvents, onRefresh, onError, onNotice,
}: Pick<Props, 'financialEvents' | 'onRefresh' | 'onError' | 'onNotice'>) {
  const verifiedEvents = useMemo(() => financialEvents.filter((event) => event.reconciliationState === 'verified'), [financialEvents])
  const [sourceEventId, setSourceEventId] = useState('')
  const [toCurrency, setToCurrency] = useState('USD')
  const [rateNumerator, setRateNumerator] = useState('1')
  const [rateDenominator, setRateDenominator] = useState('100')
  const [rateSource, setRateSource] = useState('Manual statement rate')
  const [sourceUrl, setSourceUrl] = useState('')
  const [observedAt, setObservedAt] = useState(nowLocalInput)
  const [saving, setSaving] = useState(false)
  const sourceEvent = verifiedEvents.find((event) => event.id === sourceEventId) ?? verifiedEvents[0]
  const calculated = sourceEvent ? exactConvertedMinor(sourceEvent.amountMinor, rateNumerator, rateDenominator) : null
  const targetCurrency = toCurrency.toUpperCase()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sourceEvent) { onError('A verified source financial event is required before recording FX.'); return }
    if (sourceEvent.currency === targetCurrency) { onError('Choose a target currency different from the source currency.'); return }
    if (!calculated) { onError('Enter a positive integer numerator and denominator.'); return }
    setSaving(true); onError(''); onNotice('')
    try {
      await send('/api/money-maker/fx-conversions', 'POST', {
        sourceEventId: sourceEvent.id, fromAmountMinor: sourceEvent.amountMinor, fromCurrency: sourceEvent.currency,
        toAmountMinor: calculated, toCurrency: targetCurrency,
        rateNumerator, rateDenominator, rateSource, sourceUrl, observedAt: toIso(observedAt),
        idempotencyKey: 'hq-fx-conversion-' + crypto.randomUUID(),
      })
      onNotice('FX conversion provenance recorded. Original financial event and its currency remain unchanged.')
      setSourceUrl('')
      await onRefresh()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Unable to record FX conversion.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form data-testid="fx-conversion-form" onSubmit={submit} className="space-y-3">
      {verifiedEvents.length === 0 ? (
        <p className="rounded border border-dashed border-border p-4 text-xs text-muted-foreground">No verified source events yet. Record an event, attach source evidence and mark it verified first.</p>
      ) : (
        <>
          <label className="block space-y-1 text-xs font-medium">Verified source event
            <select required value={sourceEvent?.id ?? ''} onChange={(event) => setSourceEventId(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm">
              {verifiedEvents.map((item) => <option key={item.id} value={item.id}>{item.eventType} · {minor(item.amountMinor, item.currency)} · {item.id.slice(0, 8)}</option>)}
            </select>
          </label>
          {sourceEvent && <p className="text-xs text-muted-foreground">Source amount: {minor(sourceEvent.amountMinor, sourceEvent.currency)}. This source record is not modified.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-xs font-medium">Target currency
              <input required minLength={3} maxLength={3} pattern="[A-Z]{3}" value={toCurrency} onChange={(event) => setToCurrency(event.target.value.toUpperCase())} className="w-full rounded border border-input bg-background px-3 py-2 text-sm uppercase" />
            </label>
            <label className="block space-y-1 text-xs font-medium">Rate source
              <input required minLength={2} maxLength={200} value={rateSource} onChange={(event) => setRateSource(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1 text-xs font-medium">Rate numerator
              <input required inputMode="numeric" pattern="[1-9][0-9]{0,37}" value={rateNumerator} onChange={(event) => setRateNumerator(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1 text-xs font-medium">Rate denominator
              <input required inputMode="numeric" pattern="[1-9][0-9]{0,37}" value={rateDenominator} onChange={(event) => setRateDenominator(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <p className="rounded bg-muted/50 p-3 text-xs">Calculated target amount: <strong>{calculated ?? '—'}</strong> minor units using exact integer arithmetic and half-up rounding. Rate is target minor units per source minor unit.</p>
          <label className="block space-y-1 text-xs font-medium">FX evidence URL
            <input required type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1 text-xs font-medium">Rate observed at
            <input required type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={saving || !calculated || sourceEvent?.currency === targetCurrency} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Recording…' : 'Record FX conversion'}</button>
        </>
      )}
    </form>
  )
}
