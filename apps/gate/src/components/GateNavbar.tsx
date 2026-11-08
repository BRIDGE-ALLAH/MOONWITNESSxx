import React from 'react'

export function GateNavbar() {
  return (
    <header className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono">
          MW
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono block">
            Ecosystem Gateway
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white font-mono">
            MOONWITNESS GATE
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-300">
          EXPERIENCE 01 / 09
        </div>
        <div className="text-xs font-mono px-3 py-1 bg-emerald-950/40 border border-emerald-800/40 rounded-full text-emerald-400 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ONLINE
        </div>
      </div>
    </header>
  )
}
