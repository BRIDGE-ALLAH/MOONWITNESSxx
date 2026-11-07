'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavigationItem } from './navigation'

type CommandPaletteProps = { open: boolean; items: NavigationItem[]; onClose: () => void }

export function CommandPalette({ open, items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const filteredItems = useMemo(
    () => items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())),
    [items, query],
  )

  useEffect(() => {
    if (!open) {
      previousFocusRef.current?.focus()
      return
    }
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    inputRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="headquarter-command-title" className="w-full max-w-xl border-2 border-acid-lime/40 bg-background p-3">
        <h2 id="headquarter-command-title" className="sr-only">Command palette</h2>
        <label htmlFor="headquarter-command-search" className="sr-only">Search Headquarter modules</label>
        <input
          ref={inputRef}
          id="headquarter-command-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a module name…"
          className="w-full border border-acid-lime/30 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-acid-lime"
        />
        <ul className="mt-2 max-h-72 overflow-auto" aria-label="Matching modules">
          {filteredItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={onClose} className="block border-b border-acid-lime/10 px-2 py-2 font-mono text-xs uppercase hover:bg-acid-lime/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acid-lime">{item.label}</Link>
            </li>
          ))}
          {filteredItems.length === 0 ? <li className="px-2 py-3 text-sm text-muted-foreground" role="status">No matching modules.</li> : null}
        </ul>
      </section>
    </div>
  )
}
