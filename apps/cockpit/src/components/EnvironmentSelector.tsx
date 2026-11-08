'use client'

import React, { useState, useEffect } from 'react'

export type EnvironmentTarget = 'local' | 'development' | 'production'

export interface EnvironmentConfig {
  id: EnvironmentTarget
  label: string
  badgeColor: string
  baseUrls: {
    arsy: string
    oracle: string
    postgres: string
    radius: string
  }
}

export const ENVIRONMENTS: Record<EnvironmentTarget, EnvironmentConfig> = {
  local: {
    id: 'local',
    label: 'LOCAL WORKSTATION',
    badgeColor: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    baseUrls: {
      arsy: 'http://localhost:4000',
      oracle: 'http://localhost:8000',
      postgres: 'localhost:5432',
      radius: 'localhost:1812',
    },
  },
  development: {
    id: 'development',
    label: 'DEV STAGING CLUSTER',
    badgeColor: 'bg-sky-500/10 border-sky-500/40 text-sky-400',
    baseUrls: {
      arsy: 'https://dev-api.moonwitness.internal',
      oracle: 'https://dev-oracle.moonwitness.internal',
      postgres: 'dev-db.moonwitness.internal:5432',
      radius: 'dev-radius.moonwitness.internal:1812',
    },
  },
  production: {
    id: 'production',
    label: 'PRODUCTION AIR-GAPPED',
    badgeColor: 'bg-rose-500/10 border-rose-500/40 text-rose-400',
    baseUrls: {
      arsy: 'https://api.moonwitness.biz.id',
      oracle: 'https://oracle.moonwitness.biz.id',
      postgres: 'prod-db.moonwitness.biz.id:5432',
      radius: 'prod-radius.moonwitness.biz.id:1812',
    },
  },
}

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
