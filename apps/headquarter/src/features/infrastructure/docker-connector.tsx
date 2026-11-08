'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

type DockerServer = { id: string; name: string; kind: 'local' | 'remote'; endpointUrl: string | null; createdAt: string }
type DockerContainer = { id: string; names: string[]; image: string; state: string; status: string; createdAt: number }
type DockerContainerLogs = { stdout: string; stderr: string }
type DockerContainerStats = {
  observedAt: string | null
  cpuPercent: number | null
  memoryUsageBytes: number | null
  memoryLimitBytes: number | null
  memoryPercent: number | null
  pids: number | null
  networkRxBytes: number | null
  networkTxBytes: number | null
  blockReadBytes: number | null
  blockWriteBytes: number | null
}
type ApiPayload<T> = { data?: T; error?: { code?: string; message?: string } }

function formatBytes(value: number | null): string {
  if (value === null) return 'Unavailable'
  if (value < 1024) return `${value} B`
  const units = ['KiB', 'MiB', 'GiB', 'TiB']
  let amount = value
  let unit = -1
  do { amount /= 1024; unit += 1 } while (amount >= 1024 && unit < units.length - 1)
  return `${amount.toFixed(1)} ${units[unit]}`
}

function formatPercent(value: number | null): string {
  return value === null ? 'Unavailable' : `${value.toFixed(1)}%`
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...init?.headers } })
  const payload = await response.json().catch(() => ({})) as ApiPayload<T>
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sesi operator diperlukan. Silakan login.')
    if (response.status === 503) throw new Error(payload.error?.message || 'Autentikasi atau koneksi ARSY belum dikonfigurasi.')
    throw new Error(payload.error?.message || payload.error?.code || `Request gagal (${response.status})`)
  }
  return payload.data as T
}

export function DockerConnector() {
  const [servers, setServers] = useState<DockerServer[]>([])
  const [selected, setSelected] = useState<string>('')
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [logs, setLogs] = useState<DockerContainerLogs | null>(null)
  const [logsContainer, setLogsContainer] = useState('')
  const [monitorContainer, setMonitorContainer] = useState('')
  const [monitorStats, setMonitorStats] = useState<DockerContainerStats | null>(null)
  const [monitorError, setMonitorError] = useState('')
  const [engine, setEngine] = useState<Record<string, unknown> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('Local Docker')
  const [remote, setRemote] = useState(false)
  const [endpointUrl, setEndpointUrl] = useState('')
  const [ca, setCa] = useState('')
  const [cert, setCert] = useState('')
  const [key, setKey] = useState('')

  const loadServers = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const items = await api<DockerServer[]>('/api/infrastructure/docker/servers')
      setServers(items)
      if (!selected && items[0]) setSelected(items[0].id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Tidak dapat memuat Docker servers.') }
    finally { setBusy(false) }
  }, [selected])

  const loadInventory = useCallback(async (id: string) => {
    if (!id) return
    setLogs(null); setLogsContainer('')
    setBusy(true); setError('')
    try {
      const [info, inventory] = await Promise.all([
        api<{ server: DockerServer; engine: Record<string, unknown> }>(`/api/infrastructure/docker/servers/${id}/info`),
        api<{ containers: DockerContainer[] }>(`/api/infrastructure/docker/servers/${id}/containers`),
      ])
      setEngine(info.engine)
      setContainers(inventory.containers)
    } catch (cause) { setEngine(null); setContainers([]); setError(cause instanceof Error ? cause.message : 'Docker Engine tidak tersedia.') }
    finally { setBusy(false) }
  }, [])

  useEffect(() => { void loadServers() }, [loadServers])
  useEffect(() => { void loadInventory(selected) }, [loadInventory, selected])

  useEffect(() => {
    if (!selected || !monitorContainer) {
      setMonitorStats(null)
      setMonitorError('')
      return
    }

    let active = true
    let pending = false
    let timer: ReturnType<typeof window.setTimeout> | undefined
    const poll = async () => {
      if (!active || pending) return
      pending = true
      try {
        const result = await api<{ containerId: string; stats: DockerContainerStats }>(
          `/api/infrastructure/docker/servers/${selected}/containers/${monitorContainer}/stats`,
        )
        if (active) {
          setMonitorStats(result.stats)
          setMonitorError('')
        }
      } catch (cause) {
        if (active) {
          setMonitorStats(null)
          setMonitorError(cause instanceof Error ? cause.message : 'Runtime telemetry is unavailable.')
        }
      } finally {
        pending = false
        if (active) timer = window.setTimeout(() => { void poll() }, 10_000)
      }
    }

    void poll()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [selected, monitorContainer])

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = remote
        ? { name, kind: 'remote', endpointUrl, tls: { ca, cert, key } }
        : { name, kind: 'local' }
      const registered = await api<DockerServer>('/api/infrastructure/docker/servers', { method: 'POST', body: JSON.stringify(payload) })
      setEndpointUrl(''); setCa(''); setCert(''); setKey('')
      setSelected(registered.id)
      await loadServers()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Koneksi Docker gagal.') }
    finally { setBusy(false) }
  }

  const loadLogs = useCallback(async (serverId: string, containerId: string) => {
    if (!serverId || !containerId) return
    setBusy(true); setError(''); setLogsContainer(containerId); setLogs(null)
    try {
      const result = await api<{ containerId: string; logs: DockerContainerLogs; tail: number }>(
        `/api/infrastructure/docker/servers/${serverId}/containers/${containerId}/logs`,
      )
      setLogs(result.logs)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Container logs tidak tersedia.')
    } finally { setBusy(false) }
  }, [])

  const selectedServer = servers.find((server) => server.id === selected)
  const engineMetrics: Array<[string, string]> = [
    ['Engine', String(engine?.serverVersion ?? '—')],
    ['OS', String(engine?.operatingSystem ?? '—')],
    ['Containers', String(containers.length)],
  ]
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">Infrastructure / Runtime</p><h1 className="mt-2 font-display text-4xl uppercase">Docker Connector</h1><p className="mt-2 text-sm text-muted-foreground">Read-only Docker Engine inventory. Mutating container operations are intentionally disabled.</p></div>
        <button onClick={() => void loadServers()} disabled={busy} className="border border-border px-4 py-2 font-mono text-xs uppercase">Refresh</button>
      </header>
      {error && <div role="alert" className="border border-destructive/50 p-3 text-sm">{error} {error.includes('login') || error.includes('Sesi') ? <Link className="underline" href="/login?returnTo=%2Finfrastructure%2Fdocker">Login operator</Link> : null}</div>}
      <section className="grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_2fr]">
        <div className="space-y-4 border border-border p-4">
          <h2 className="font-mono text-xs uppercase tracking-widest">Docker servers</h2>
          {servers.length === 0 && !busy ? <p className="text-sm text-muted-foreground">Belum ada Docker Engine yang terdaftar.</p> : null}
          <ul className="space-y-2">{servers.map((server) => <li key={server.id}><button onClick={() => { if (selected !== server.id) setMonitorContainer(''); setSelected(server.id) }} className={`w-full border p-3 text-left ${selected === server.id ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="block font-mono text-sm">{server.name}</span><span className="text-xs text-muted-foreground">{server.kind.toUpperCase()} · {server.endpointUrl || 'Unix socket (server-side)'}</span></button></li>)}</ul>
          <form onSubmit={connect} className="space-y-3 border-t border-border pt-4">
            <h3 className="font-mono text-xs uppercase">Register engine</h3>
            <label className="block text-xs">Name<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-border bg-background p-2" /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} /> Remote Engine (mutual TLS)</label>
            {remote ? <><label className="block text-xs">HTTPS endpoint<input required value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://docker.example.com:2376" className="mt-1 w-full border border-border bg-background p-2" /></label><label className="block text-xs">CA certificate<textarea required value={ca} onChange={(e) => setCa(e.target.value)} className="mt-1 w-full border border-border bg-background p-2" rows={3} /></label><label className="block text-xs">Client certificate<textarea required value={cert} onChange={(e) => setCert(e.target.value)} className="mt-1 w-full border border-border bg-background p-2" rows={3} /></label><label className="block text-xs">Client private key<textarea required value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full border border-border bg-background p-2" rows={3} /></label></> : <p className="text-xs text-muted-foreground">Uses the server-configured Docker Unix socket. No socket path is accepted from the browser.</p>}
            <button disabled={busy} className="w-full bg-primary px-3 py-2 font-mono text-xs uppercase text-primary-foreground disabled:opacity-50">{busy ? 'Connecting…' : 'Test & register'}</button>
          </form>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">{engineMetrics.map(([label,value]) => <div key={label} className="border border-border p-4"><p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-2 truncate text-lg">{String(value)}</p></div>)}</div>
          <div className="border border-border"><div className="border-b border-border p-4"><h2 className="font-mono text-xs uppercase tracking-widest">Container inventory</h2><p className="mt-1 text-xs text-muted-foreground">{selectedServer?.name ?? 'Pilih server'} · Maximum 100 records</p></div>
            {containers.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{busy ? 'Memuat inventory…' : 'Tidak ada container, atau belum ada server yang dipilih.'}</p> : <div className="divide-y divide-border">{containers.map((container) => <div key={container.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-mono text-sm">{container.names[0] || container.id.slice(0,12)}</p><p className="truncate text-xs text-muted-foreground">{container.image} · {container.id.slice(0,12)}</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="font-mono text-xs uppercase">{container.state}</p><p className="text-xs text-muted-foreground">{container.status}</p></div><button onClick={() => { setMonitorContainer(container.id); setMonitorStats(null); setMonitorError('') }} disabled={busy} className="border border-border px-3 py-2 font-mono text-[10px] uppercase">{monitorContainer === container.id ? 'Monitoring' : 'Monitor'}</button><button onClick={() => void loadLogs(selected, container.id)} disabled={busy} className="border border-border px-3 py-2 font-mono text-[10px] uppercase">Logs</button></div></div>)}</div>}
          </div>
          {monitorContainer ? <section className="border border-border p-4" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-mono text-xs uppercase tracking-widest">Runtime telemetry</h2><p className="mt-1 text-xs text-muted-foreground">{selectedServer?.name ?? 'Docker Engine'} · {monitorContainer.slice(0, 12)} · one-shot sample every 10 seconds</p></div>
              <button onClick={() => { setMonitorContainer(''); setMonitorStats(null); setMonitorError('') }} className="border border-border px-3 py-2 font-mono text-[10px] uppercase">Stop monitoring</button>
            </div>
            {monitorError ? <p role="alert" className="mt-4 text-sm text-destructive">{monitorError}</p> : null}
            {monitorStats ? <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['CPU', formatPercent(monitorStats.cpuPercent)],
                  ['Memory working set', formatBytes(monitorStats.memoryUsageBytes)],
                  ['Memory limit', formatBytes(monitorStats.memoryLimitBytes)],
                  ['Memory usage', formatPercent(monitorStats.memoryPercent)],
                  ['Processes', monitorStats.pids === null ? 'Unavailable' : String(monitorStats.pids)],
                  ['Network RX', formatBytes(monitorStats.networkRxBytes)],
                  ['Network TX', formatBytes(monitorStats.networkTxBytes)],
                  ['Block I/O read / write', `${formatBytes(monitorStats.blockReadBytes)} / ${formatBytes(monitorStats.blockWriteBytes)}`],
                ].map(([label, value]) => <div key={label} className="border border-border p-3"><p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-2 truncate text-sm">{value}</p></div>)}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Observed by Docker Engine: {monitorStats.observedAt ? new Date(monitorStats.observedAt).toLocaleString() : 'timestamp unavailable'}. Samples are live reads and are not stored as historical metrics.</p>
            </> : !monitorError ? <p className="mt-4 text-sm text-muted-foreground">Waiting for the first Docker Engine sample…</p> : null}
          </section> : null}
          {logs ? <section className="border border-border"><div className="flex items-center justify-between border-b border-border p-4"><div><h2 className="font-mono text-xs uppercase tracking-widest">Container logs</h2><p className="mt-1 text-xs text-muted-foreground">{logsContainer.slice(0, 12)} · last 200 lines</p></div><button onClick={() => { setLogs(null); setLogsContainer('') }} className="border border-border px-3 py-2 font-mono text-[10px] uppercase">Close</button></div><pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed">{logs.stdout}{logs.stderr ? `\n[stderr]\n${logs.stderr}` : ''}</pre></section> : null}
        </div>
      </section>
    </main>
  )
}
