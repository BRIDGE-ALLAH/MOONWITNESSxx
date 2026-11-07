'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

type Asset = {
  id: string
  fileName: string
  mediaType: string
  byteSize: string
  sha256: string
  createdAt: string
  provenance: {
    creator: string
    license: string
    permissionBasis: string
    toolModel?: string
    disclosure: string
  }
}
type Readiness = {
  ready: boolean
  inspections: Record<'rights' | 'policy' | 'technical-qa' | 'creative-qa', { status: 'pass' | 'blocked' | 'unknown'; source: 'operator-attestation' | 'automated-check' | 'independent-review' | null; reviewedAt: string | null; reviewedBy: string | null }>
}
type Props = { productId: string; productVersion: number }
const inspectionTypes = [
  ['rights', 'Rights & licensing'],
  ['policy', 'Channel policy'],
  ['technical-qa', 'Technical QA'],
  ['creative-qa', 'Creative QA'],
] as const

function encodeBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    binary += String.fromCharCode(...view.subarray(offset, Math.min(offset + chunkSize, view.length)))
  }
  return btoa(binary)
}

export function AssetManager({ productId, productVersion }: Props) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [readiness, setReadiness] = useState<Record<string, Readiness>>({})
  const [file, setFile] = useState<File | null>(null)
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [creator, setCreator] = useState('')
  const [sourceAssetId, setSourceAssetId] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [editHistoryNotes, setEditHistoryNotes] = useState('')
  const [license, setLicense] = useState('')
  const [permissionBasis, setPermissionBasis] = useState('')
  const [toolModel, setToolModel] = useState('')
  const [disclosure, setDisclosure] = useState('')
  const [inspectionType, setInspectionType] = useState<(typeof inspectionTypes)[number][0]>('rights')
  const [inspectionStatus, setInspectionStatus] = useState<'pass' | 'blocked' | 'unknown'>('unknown')
  const [inspectionSource, setInspectionSource] = useState<'operator-attestation' | 'automated-check' | 'independent-review'>('operator-attestation')
  const [inspectionRationale, setInspectionRationale] = useState('')
  const [inspectionEvidence, setInspectionEvidence] = useState('')
  const [activeInspection, setActiveInspection] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/assets?productId=${encodeURIComponent(productId)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load product assets.')
      const rows: Asset[] = payload.data ?? []
      setAssets(rows)
      const states = await Promise.all(rows.map(async (asset) => {
        const result = await fetch(`/api/assets/${asset.id}/readiness`, { cache: 'no-store' })
        const body = await result.json()
        if (!result.ok) throw new Error(body.error?.message || 'Unable to load asset readiness.')
        return [asset.id, body.data as Readiness] as const
      }))
      setReadiness(Object.fromEntries(states))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product assets.')
    } finally { setLoading(false) }
  }, [productId])
  useEffect(() => { void refresh() }, [refresh])

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    setUploadKey(selected ? crypto.randomUUID() : null)
    setError('')
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) { setError('Choose an asset file first.'); return }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) { setError('Asset file must be between 1 byte and 10 MiB.'); return }
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'application/zip'].includes(file.type)) {
      setError('Only PNG, JPEG, WebP, PDF, plain text and ZIP files are accepted.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': uploadKey ?? crypto.randomUUID() },
        body: JSON.stringify({
          productId,
          productVersion,
          fileName: file.name,
          mediaType: file.type,
          contentBase64: encodeBase64(await file.arrayBuffer()),
          provenance: {
            creator, license, permissionBasis, toolModel: toolModel || undefined,
            sourceAssetId: sourceAssetId.trim() || undefined,
            sourceReference: sourceReference.trim() || undefined,
            editHistory: editHistoryNotes.trim() ? [{ action: 'Recorded asset edit history', actor: creator, occurredAt: new Date().toISOString(), notes: editHistoryNotes.trim() }] : [],
            disclosure,
          },
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to store asset.')
      setFile(null); setUploadKey(null); setCreator(''); setSourceAssetId(''); setSourceReference(''); setEditHistoryNotes(''); setLicense(''); setPermissionBasis(''); setToolModel(''); setDisclosure('')
      setMessage('Asset bytes and provenance stored. Inspection gates remain unknown until recorded.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to store asset.')
    } finally { setSaving(false) }
  }

  async function recordInspection(assetId: string) {
    if (inspectionRationale.trim().length < 10) { setError('Inspection rationale must contain at least 10 characters.'); return }
    if (inspectionStatus !== 'unknown' && !inspectionEvidence.trim()) { setError('A pass or blocked inspection needs a supporting evidence URL or reference.'); return }
    setActiveInspection(assetId); setError(''); setMessage('')
    try {
      const evidence = inspectionEvidence.trim()
        ? [{ label: 'Operator-supplied inspection evidence', ...(inspectionEvidence.startsWith('http') ? { url: inspectionEvidence } : { reference: inspectionEvidence }) }]
        : []
      const response = await fetch(`/api/assets/${assetId}/inspections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inspectionType, status: inspectionStatus, inspectionSource,
          rationale: inspectionRationale.trim(), findings: [], evidence,
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to record inspection.')
      setInspectionRationale(''); setInspectionEvidence('')
      setMessage('Inspection record appended. Operator-created records remain attestations; a trusted reviewer or automated service actor is required to satisfy channel readiness.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record inspection.')
    } finally { setActiveInspection('') }
  }

  return <section className="space-y-4 border-t border-acid-lime/15 pt-4">
    <div><h4 className="font-display text-lg uppercase">SIDRA ARCHIVE / Assets</h4><p className="text-xs text-muted-ink">Version-bound bytes, SHA-256 and provenance. Uploads are private; no asset is channel-ready until every required inspection passes.</p></div>
    {error && <div role="alert" className="border border-red-500/40 p-3 text-xs">{error}</div>}
    {message && <div role="status" className="border border-acid-lime/30 p-3 text-xs">{message}</div>}
    {loading ? <p className="text-xs text-muted-ink">Loading persisted assets…</p> : assets.length === 0 ? <p className="border border-dashed border-acid-lime/20 p-3 text-xs text-muted-ink">No asset bytes stored for this product version.</p> : <div className="space-y-3">{assets.map((asset) => {
      const gate = readiness[asset.id]
      return <article key={asset.id} className="space-y-2 border border-acid-lime/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{asset.fileName}</p><a className="font-mono text-[10px] uppercase text-acid-lime underline" href={`/api/assets/${asset.id}/download`}>Download original</a></div>
        <p className="break-all font-mono text-[10px] text-muted-ink">{asset.mediaType} · {asset.byteSize} bytes · SHA-256 {asset.sha256}</p>
        <p className="text-xs text-muted-ink">Creator: {asset.provenance.creator} · License: {asset.provenance.license}</p>
        <p className="text-xs text-muted-ink">Permission basis: {asset.provenance.permissionBasis}</p>
        <p className="text-xs text-muted-ink">Disclosure: {asset.provenance.disclosure}</p>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono uppercase md:grid-cols-4">{inspectionTypes.map(([key, label]) => <div key={key} className="border border-acid-lime/15 p-2"><p className="text-muted-ink">{label}</p><p className={gate?.inspections[key]?.status === 'pass' ? 'mt-1 text-acid-lime' : gate?.inspections[key]?.status === 'blocked' ? 'mt-1 text-red-300' : 'mt-1 text-orange-200'}>{gate?.inspections[key]?.status ?? 'unknown'}</p><p className="mt-1 break-words text-[9px] text-muted-ink">{gate?.inspections[key]?.source ?? 'no source'}</p></div>)}</div>
        <p className={gate?.ready ? 'text-xs text-acid-lime' : 'text-xs text-orange-200'}>{gate?.ready ? 'All required inspection statuses and trusted source qualifications are satisfied.' : 'Not channel-ready: missing/blocked checks, self-attested records, or untrusted inspection actors.'}</p>
        <details className="border-t border-acid-lime/10 pt-2">
          <summary className="cursor-pointer font-mono text-[10px] uppercase text-muted-ink">Append operator inspection attestation</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-[10px] font-mono uppercase">Inspection source<select value={inspectionSource} onChange={(event) => setInspectionSource(event.target.value as typeof inspectionSource)} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="operator-attestation">Operator attestation</option><option value="automated-check">Automated check</option><option value="independent-review">Independent review (reported)</option></select></label>
            <label className="text-[10px] font-mono uppercase">Inspection type<select value={inspectionType} onChange={(event) => setInspectionType(event.target.value as typeof inspectionType)} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case">{inspectionTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-[10px] font-mono uppercase">Status<select value={inspectionStatus} onChange={(event) => setInspectionStatus(event.target.value as typeof inspectionStatus)} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case"><option value="unknown">Unknown</option><option value="pass">Pass · operator attestation</option><option value="blocked">Blocked</option></select></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Rationale<textarea value={inspectionRationale} onChange={(event) => setInspectionRationale(event.target.value)} rows={2} maxLength={2000} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-mono uppercase md:col-span-2">Evidence URL or reference<input value={inspectionEvidence} onChange={(event) => setInspectionEvidence(event.target.value)} className="mt-1 w-full border border-acid-lime/20 bg-obsidian p-2 text-xs normal-case" /></label>
            <button type="button" disabled={activeInspection === asset.id} onClick={() => void recordInspection(asset.id)} className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-40 md:col-span-2">{activeInspection === asset.id ? 'Recording…' : 'Append inspection record'}</button>
          </div>
        </details>
      </article>
    })}</div>}
    <form onSubmit={upload} className="space-y-3 border border-acid-lime/20 bg-obsidian p-3">
      <h5 className="font-mono text-xs uppercase text-acid-lime">Upload asset · product v{productVersion}</h5>
      <label className="block text-[10px] font-mono uppercase">Asset file<input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.zip" onChange={selectFile} className="mt-1 block w-full text-xs normal-case" /></label>
      {file && <p className="text-xs text-muted-ink">{file.name} · {file.size} bytes · {file.type || 'unknown type'}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[10px] font-mono uppercase">Creator / owner<input required value={creator} onChange={(event) => setCreator(event.target.value)} className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">License<input required value={license} onChange={(event) => setLicense(event.target.value)} placeholder="Exact license or original-work statement" className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Source asset ID (optional)<input value={sourceAssetId} onChange={(event) => setSourceAssetId(event.target.value)} placeholder="UUID of an earlier asset owned here" className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Source reference (optional)<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="Original URL, source identifier or archive reference" className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase md:col-span-2">Permission basis<textarea required value={permissionBasis} onChange={(event) => setPermissionBasis(event.target.value)} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Tool / model (if relevant)<input value={toolModel} onChange={(event) => setToolModel(event.target.value)} className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase md:col-span-2">Edit history (optional)<textarea value={editHistoryNotes} onChange={(event) => setEditHistoryNotes(event.target.value)} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
        <label className="text-[10px] font-mono uppercase">Disclosure<textarea required value={disclosure} onChange={(event) => setDisclosure(event.target.value)} rows={2} className="mt-1 w-full border border-acid-lime/20 bg-panel-charcoal p-2 text-xs normal-case" /></label>
      </div>
      <button type="submit" disabled={saving || !file} className="bg-acid-lime px-4 py-2 font-mono text-[10px] font-bold uppercase text-obsidian disabled:opacity-40">{saving ? 'Storing asset…' : 'Store bytes & provenance'}</button>
    </form>
  </section>
}
