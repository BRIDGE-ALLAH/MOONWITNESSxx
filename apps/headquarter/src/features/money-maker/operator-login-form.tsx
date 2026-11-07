'use client'

import { useState, type FormEvent } from 'react'

export function OperatorLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'Login failed.')
      window.location.assign('/riot-radar')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed.')
    } finally { setLoading(false) }
  }

  return <main className="flex min-h-[70vh] items-center justify-center bg-obsidian p-6 text-paper-bone"><form onSubmit={submit} className="w-full max-w-md space-y-5 border border-acid-lime/30 bg-panel-charcoal p-7"><p className="font-mono text-xs uppercase tracking-[0.25em] text-acid-lime">RIOTWORKS / Operator Access</p><h1 className="font-display text-4xl uppercase">Operator Login</h1><p className="text-sm text-muted-ink">Private access to commercial records and opportunity workflows.</p>{error && <p role="alert" className="border border-red-500/50 p-3 text-sm">{error}</p>}<label className="block space-y-2 text-xs font-mono uppercase">Operator password<input autoComplete="current-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-acid-lime/20 bg-obsidian p-3 text-sm normal-case" /></label><button disabled={loading} className="w-full bg-acid-lime p-3 font-mono text-xs font-bold uppercase text-obsidian disabled:opacity-50">{loading ? 'Authenticating…' : 'Enter Headquarter'}</button></form></main>
}
