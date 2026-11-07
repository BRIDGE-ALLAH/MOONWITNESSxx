'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type AssetRecord = {
  id: string
  productVersionId: string
  filename: string
  mediaType: string
  checksumSha256: string | null
  provenance: {
    creator: string
    license: string
    sourceUrl?: string
    originalDeclaration?: string
    toolModel?: string
    editHistory: string[]
    disclosure: string
    derivativeOf?: string
  }
  rightsState: 'pass' | 'blocked' | 'unknown'
  createdAt: string
}

type Props = { productVersionId: string }

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }
  return btoa(chunks.join(''))
}

export function AssetManager({ productVersionId }: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/assets?productVersionId=${encodeURIComponent(productVersionId)}`, { cache: 'no-store' })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load product assets.')
      setAssets(payload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product assets.')
    } finally {
      setLoading(false)
    }
  }, [productVersionId])

  useEffect(() => { void refresh() }, [refresh])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a file before uploading.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Asset files are limited to 5 MiB.')
      return
    }

    const mediaType = file.type || ({
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    }[file.name.slice(file.name.lastIndexOf('.')).toLowerCase()] ?? '')
    if (!mediaType) {
      setError('The file must have a supported media type: PDF, ZIP, JSON, TXT, PNG, JPEG or WebP.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productVersionId,
          filename: file.name,
          mediaType,
          contentBase64: toBase64(await file.arrayBuffer()),
          rightsState: String(data.get('rightsState') || 'unknown'),
          provenance: {
            creator: String(data.get('creator') || ''),
            license: String(data.get('license') || ''),
            sourceUrl: String(data.get('sourceUrl') || '') || undefined,
            originalDeclaration: String(data.get('originalDeclaration') || '') || undefined,
            toolModel: String(data.get('toolModel') || '') || undefined,
            editHistory: String(data.get('editHistory') || '').split('\n').map((item) => item.trim()).filter(Boolean),
            disclosure: String(data.get('disclosure') || ''),
            derivativeOf: String(data.get('derivativeOf') || '') || undefined,
          },
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to upload asset.')
      form.reset()
      setMessage(`Uploaded ${payload.data.filename}; SHA-256 ${payload.data.checksumSha256}.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to upload asset.')
    } finally {
      setSaving(false)
    }
  }

  async function archive(asset: AssetRecord) {
    setArchivingId(asset.id)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
      const payload = response.status === 204 ? null : await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to archive asset.')
      setMessage(`Archived ${asset.filename}. The stored binary is retained for recovery.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive asset.')
    } finally {
      setArchivingId('')
    }
  }

  return (
    <section className="mt-4 space-y-4 border-t border-acid-lime/20 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-display text-base uppercase">Version assets & provenance</h4>
          <p className="text-[11px] text-muted-ink">Private binary storage · SHA-256 · maximum 5 MiB per file</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="border border-acid-lime/30 px-3 py-2 font-mono text-[10px] uppercase">Refresh assets</button>
      </div>

      {error && <p role="alert" className="border border-red-500/50 p-3 text-xs">{error}</p>}
      {message && <p role="status" className="border border-acid-lime/30 p-3 text-xs">{message}</p>}

      {loading ? <p className="text-xs text-muted-ink">Loading assets…</p> : assets.length === 0 ? (
        <p className="border border-dashed border-acid-lime/25 p-3 text-xs text-muted-ink">No files are attached to this product version.</p>
      ) : (
        <ul className="space-y-2">
          {assets.map((asset) => (
            <li key={asset.id} className="flex flex-wrap items-start justify-between gap-3 border border-acid-lime/15 p-3">
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm">{asset.filename}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-muted-ink">
                  {asset.mediaType} · rights {asset.rightsState} · {new Date(asset.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted-ink">SHA-256: {asset.checksumSha256 ?? 'Not available'}</p>
                <p className="mt-1 text-[10px] text-muted-ink">
                  Creator: {asset.provenance.creator} · License: {asset.provenance.license}
                </p>
                {asset.provenance.sourceUrl && <a className="mt-1 inline-block text-[10px] underline" href={asset.provenance.sourceUrl} target="_blank" rel="noreferrer">Open source evidence</a>}
              </div>
              <div className="flex gap-2">
                <a href={`/api/assets/${asset.id}/content`} className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase">Download</a>
                <button type="button" disabled={archivingId === asset.id} onClick={() => void archive(asset)} className="border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase text-red-300 disabled:opacity-50">
                  {archivingId === asset.id ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <details className="border border-acid-lime/20 p-3">
        <summary className="cursor-pointer font-mono text-xs uppercase">Upload asset with provenance</summary>
        <form onSubmit={upload} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-[11px] text-muted-ink">File (PDF, ZIP, JSON, TXT, PNG, JPEG, WebP)
            <input name="file" type="file" required accept=".pdf,.zip,.json,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/zip,application/json,text/plain,image/png,image/jpeg,image/webp" className="block w-full text-xs" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Rights state
            <select name="rightsState" defaultValue="unknown" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone">
              <option value="unknown">Unknown — not reviewed</option>
              <option value="pass">Pass — evidence supplied</option>
              <option value="blocked">Blocked — do not use</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Creator / owner
            <input name="creator" required minLength={2} maxLength={200} placeholder="Person or organization responsible" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">License
            <input name="license" required minLength={2} maxLength={300} placeholder="License or rights statement" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Source URL (optional when original declaration is supplied)
            <input name="sourceUrl" type="url" placeholder="https://…" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Original-work declaration
            <input name="originalDeclaration" minLength={10} maxLength={1000} placeholder="How originality/ownership is declared" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Tool / model (optional)
            <input name="toolModel" maxLength={300} placeholder="Tool, model and version if relevant" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink">Derivative of (optional)
            <input name="derivativeOf" maxLength={300} placeholder="Parent asset or source identifier" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink md:col-span-2">Edit history (one step per line)
            <textarea name="editHistory" rows={2} placeholder="Created from the declared source…" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <label className="space-y-1 text-[11px] text-muted-ink md:col-span-2">Disclosure
            <textarea name="disclosure" required minLength={3} maxLength={1000} placeholder="Disclosures required for this asset or product" className="w-full border border-acid-lime/20 bg-obsidian p-2 text-xs text-paper-bone" />
          </label>
          <p className="md:col-span-2 text-[10px] text-muted-ink">The system records operator-supplied rights metadata. It does not independently verify ownership, licenses or copyright status.</p>
          <button type="submit" disabled={saving} className="w-fit bg-acid-lime px-4 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">
            {saving ? 'Uploading…' : 'Upload to this version'}
          </button>
        </form>
      </details>
    </section>
  )
}
