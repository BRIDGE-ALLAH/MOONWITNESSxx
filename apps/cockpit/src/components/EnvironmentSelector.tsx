'use client'

import React from 'react'
import { ENVIRONMENTS, type EnvironmentConfig, type EnvironmentTarget } from '../lib/envConfig'

export type { EnvironmentConfig, EnvironmentTarget }
export { ENVIRONMENTS }

export function EnvironmentSelector({
  currentEnv,
  onSelect,
}: {
  currentEnv: EnvironmentTarget
  onSelect: (env: EnvironmentTarget) => void
}) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
      <span className="text-[10px] text-slate-500 uppercase font-mono px-2">TARGET:</span>
      {(Object.keys(ENVIRONMENTS) as EnvironmentTarget[]).map((envKey) => {
        const isSelected = currentEnv === envKey
        return (
          <button
            key={envKey}
            onClick={() => onSelect(envKey)}
            className={`px-2.5 py-1 text-xs font-mono rounded transition-all ${
              isSelected
                ? `${ENVIRONMENTS[envKey].badgeColor} font-bold shadow-sm`
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {ENVIRONMENTS[envKey].label.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}
