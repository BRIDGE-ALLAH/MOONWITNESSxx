'use client'

import React, { useState } from 'react'

export default function IdHomePage() {
  const [subject, setSubject] = useState('operator.primary')
  const [role, setRole] = useState<'operator' | 'admin' | 'subscriber' | 'guest'>('operator')
  const [issuedToken, setIssuedToken] = useState('')
  const [claimsOutput, setClaimsOutput] = useState<string>('')
  const [verifyTokenInput, setVerifyTokenInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleIssue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, role }),
      })
      const data = await res.json()
      if (data.ok) {
        setIssuedToken(data.token)
        setVerifyTokenInput(data.token)
        setClaimsOutput(JSON.stringify(data.claims, null, 2))
      } else {
        setClaimsOutput(`Error: ${data.error}`)
      }
    } catch (err: unknown) {
      setClaimsOutput(`Fetch error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyTokenInput }),
      })
      const data = await res.json()
      setVerifyResult(JSON.stringify(data, null, 2))
    } catch (err: unknown) {
      setVerifyResult(
        `Verification fetch error: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 lg:p-16 flex flex-col justify-between">
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-cyan-400 font-bold tracking-widest text-sm">
              EXPERIENCE 04 &bull; MOONWITNESS ID
            </span>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-400 border border-emerald-500/30">
              OPERATIONAL
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            Identity & Session Authority
          </h1>
        </div>
        <div className="font-mono text-xs text-slate-400 text-right">
          <div>
            Authority Realm: <span className="text-slate-200">internal</span>
          </div>
          <div>
            Port: <span className="text-cyan-400">3003</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        {/* Token Issuance Panel */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-mono mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400"></span>
              Issue Session Token
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Subject / Principal
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="operator">operator (Default)</option>
                  <option value="admin">admin (Full Governance)</option>
                  <option value="subscriber">subscriber (E-ISP Domain)</option>
                  <option value="guest">guest (Read-Only)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleIssue}
                disabled={loading}
                className="w-full rounded bg-cyan-600 hover:bg-cyan-500 font-mono text-xs font-semibold py-2.5 text-white transition-colors"
              >
                {loading ? 'Issuing...' : 'Generate Signed HMAC Token'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-mono text-slate-500 mb-1">
              Active Token Output
            </label>
            <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-cyan-300 break-all select-all max-h-24 overflow-y-auto">
              {issuedToken || '// Click Generate to issue token'}
            </div>
          </div>
        </section>

        {/* Token Verification & Inspection Panel */}
        <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white font-mono mb-4 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
              Verify Token & Claims
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Token to Verify
                </label>
                <textarea
                  rows={3}
                  value={verifyTokenInput}
                  onChange={(e) => setVerifyTokenInput(e.target.value)}
                  placeholder="Paste signed token..."
                  className="w-full rounded border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={handleVerify}
                className="w-full rounded bg-emerald-600 hover:bg-emerald-500 font-mono text-xs font-semibold py-2.5 text-white transition-colors"
              >
                Inspect Token Cryptographic Validity
              </button>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-xs font-mono text-slate-500 mb-1">
              Verification Status & Claims
            </label>
            <pre className="rounded border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
              {verifyResult || claimsOutput || '// Verification inspection output'}
            </pre>
          </div>
        </section>
      </div>

      <footer className="max-w-6xl mx-auto w-full border-t border-slate-800 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500">
        <div>MOONWITNESS ID &bull; Experience 04 &bull; Cryptographic Trust Boundary</div>
        <div>BRIDGE-ALLAH / RIOTWORKS</div>
      </footer>
    </main>
  )
}
