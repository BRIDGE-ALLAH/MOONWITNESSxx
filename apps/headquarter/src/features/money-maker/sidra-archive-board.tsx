'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

type Product = { id: string; title: string; versionId: string; version: number }
type Asset = {
  id: string; productVersionId: string; filename: string; mediaType: string; checksumSha256: string | null
  provenance: { creator: string; license: string; sourceUrl?: string; originalDeclaration?: string; toolModel?: string; disclosure: string; editHistory: string[] }
  rightsState: 'pass' | 'blocked' | 'unknown'; createdAt: string
}
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const separator = result.indexOf(',')
      if (separator < 0) reject(new Error('Unable to encode the selected file.'))
      else resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function SidraArchiveBoard() {
  const [products, setProducts] = useState<Product[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [productResponse, assetResponse] = await Promise.all([
        fetch('/api/products', { cache: 'no-store' }),
        fetch('/api/assets', { cache: 'no-store' }),
      ])
      const [productPayload, assetPayload] = await Promise.all([productResponse.json(), assetResponse.json()])
      if (productResponse.status === 401 || assetResponse.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!productResponse.ok || !assetResponse.ok) throw new Error(productPayload.error?.message || assetPayload.error?.message || 'Unable to load asset archive.')
      setProducts(productPayload.data ?? [])
      setAssets(assetPayload.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load asset archive.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function uploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    if (!(file instanceof File) || file.size === 0) {
      setError('Select a file to upload.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The file exceeds the 5 MiB upload limit.')
      return
    }
    const rightsState = String(data.get('rightsState') || 'unknown')
    const sourceUrl = String(data.get('sourceUrl') || '').trim()
    const originalDeclaration = String(data.get('originalDeclaration') || '').trim()
    if (rightsState === 'pass' && !sourceUrl && originalDeclaration.length < 10) {
      setError('A passing rights assessment needs a source URL or an original-work declaration.')
      return
    }
    setSaving(true); setError(''); setMessage('')
    try {
      const contentBase64 = await readBase64(file)
      const extension = file.name.toLowerCase().split('.').pop() ?? ''
      const inferredTypes: Record<string, string> = { pdf: 'application/pdf', zip: 'application/zip', json: 'application/json', txt: 'text/plain', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
      const mediaType = file.type || inferredTypes[extension] || 'application/octet-stream'
      const response = await fetch('/api/assets', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productVersionId: data.get('productVersionId'),
          filename: file.name,
          mediaType,
          contentBase64,
          rightsState,
          provenance: {
            creator: data.get('creator'),
            license: data.get('license'),
            ...(sourceUrl ? { sourceUrl } : {}),
            ...(originalDeclaration ? { originalDeclaration } : {}),
            toolModel: data.get('toolModel') || undefined,
            editHistory: String(data.get('editHistory') || '').split('\n').map((line) => line.trim()).filter(Boolean),
            disclosure: data.get('disclosure'),
          },
        }),
      })
      const payload = await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to store asset.')
      form.reset()
      setMessage(`Asset stored with SHA-256 ${payload.data.checksumSha256}. Binary is on the persistent ARSY volume.`)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to store asset.')
    } finally { setSaving(false) }
  }

  async function archiveAsset(asset: Asset) {
    setArchiving(asset.id); setError(''); setMessage('')
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
      const payload = response.status === 204 ? null : await response.json()
      if (response.status === 401) throw new Error('Operator login required. Sign in at /login.')
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to archive asset.')
      setMessage('Asset metadata archived. Binary is retained on disk for recovery; it is no longer listed or downloadable.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive asset.')
    } finally { setArchiving('') }
  }

  return <main className="min-h-screen bg-obsidian p-6 text-paper-bone md:p-8"><div className="mx-auto max-w-7xl space-y-8">
    <header className="border-b border-acid-lime/30 pb-6"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Asset Library</p><h1 className="mt-3 font-display text-5xl uppercase">SIDRA ARCHIVE</h1><p className="mt-3 max-w-3xl text-sm text-muted-ink">Persistent local binary storage with SHA-256 verification, version linkage and rights provenance. Maximum file size: 5 MiB. Only safe document/image formats are accepted.</p></header>
    {error && <div role="alert" className="border border-red-500/50 p-4 text-sm">{error}</div>}
    {message && <div role="status" className="break-all border border-acid-lime/40 p-4 text-sm">{message}</div>}
    <form onSubmit={uploadAsset} className="space-y-4 border border-acid-lime/30 bg-panel-charcoal p-5 md:p-7">
      <div><h2 className="font-display text-2xl uppercase">Store product asset</h2><p className="text-xs text-muted-ink">Upload a real file and record its creator, license and source provenance. Rights status defaults to unknown.</p></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Product version<select name="productVersionId" required className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm">{products.map((product) => <option key={product.versionId} value={product.versionId}>{product.title} · v{product.version}</option>)}</select></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">File<input name="file" type="file" required accept=".pdf,.zip,.json,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/zip,application/json,text/plain,image/png,image/jpeg,image/webp" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Creator / rights holder<input name="creator" required minLength={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">License / rights basis<input name="license" required minLength={2} placeholder="Original work / CC BY 4.0 / commercial license" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Rights assessment<select name="rightsState" defaultValue="unknown" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm"><option value="unknown">Unknown</option><option value="pass">Pass — operator assessed</option><option value="blocked">Blocked</option></select></label>
        <label className="space-y-1 text-xs font-mono uppercase">Source URL (optional)<input name="sourceUrl" type="url" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Original-work declaration (optional)<textarea name="originalDeclaration" rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Tool / model (optional)<input name="toolModel" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase">Disclosure<input name="disclosure" required minLength={3} placeholder="AI-assisted / no AI / third-party licensed" className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
        <label className="space-y-1 text-xs font-mono uppercase md:col-span-2">Edit history (one change per line)<textarea name="editHistory" rows={2} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm" /></label>
      </div>
      <button disabled={saving || products.length === 0} className="bg-acid-lime px-6 py-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{saving ? 'Storing asset…' : 'Upload & verify checksum'}</button>
      {products.length === 0 && <p className="text-xs text-muted-ink">Create a product version in THE FORGE before uploading an asset.</p>}
    </form>
    <section className="space-y-3"><div className="flex items-end justify-between"><div><h2 className="font-display text-2xl uppercase">Stored assets</h2><p className="text-xs text-muted-ink">Active asset records and SHA-256 checksums</p></div><button type="button" onClick={() => void refresh()} className="border border-acid-lime/40 px-4 py-2 font-mono text-xs uppercase">Refresh</button></div>
      {loading ? <p className="border border-acid-lime/20 p-5 text-sm text-muted-ink">Loading asset records…</p> : assets.length === 0 ? <p className="border border-dashed border-acid-lime/30 p-5 text-sm text-muted-ink">No stored assets yet.</p> : assets.map((asset) => <article key={asset.id} className="space-y-2 border border-acid-lime/20 bg-panel-charcoal p-4"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-display text-lg">{asset.filename}</h3><p className="text-xs text-muted-ink">{asset.mediaType} · {new Date(asset.createdAt).toLocaleString()}</p></div><span className="font-mono text-xs uppercase text-acid-lime">{asset.rightsState}</span></div><p className="break-all font-mono text-[10px] text-muted-ink">SHA-256: {asset.checksumSha256}</p><p className="text-xs text-muted-ink">Creator: {asset.provenance.creator} · License: {asset.provenance.license}</p><div className="flex flex-wrap gap-3"><a href={`/api/assets/${asset.id}/content`} className="border border-acid-lime/40 px-3 py-2 font-mono text-xs uppercase">Download</a><button type="button" disabled={archiving === asset.id} onClick={() => void archiveAsset(asset)} className="border border-red-500/50 px-3 py-2 font-mono text-xs uppercase text-red-300 disabled:opacity-50">{archiving === asset.id ? 'Archiving…' : 'Archive'}</button></div></article>)}
    </section>
    <p className="text-xs text-muted-ink">Storage uses a persistent single-node Docker volume. It is not replicated object storage; configure backups before production use. Rights status is an operator assessment and does not constitute legal advice.</p>
  </div></main>
}
