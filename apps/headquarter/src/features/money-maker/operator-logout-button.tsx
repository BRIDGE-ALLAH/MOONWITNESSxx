'use client'

import { useState } from 'react'

export function OperatorLogoutButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to end the operator session.')
      window.location.assign('/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to end the operator session.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void logout()}
        disabled={loading}
        className="border border-acid-lime/40 px-3 py-2 font-mono text-[10px] uppercase disabled:opacity-50"
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span role="alert" className="text-[10px] text-red-300">{error}</span>}
    </div>
  )
}
