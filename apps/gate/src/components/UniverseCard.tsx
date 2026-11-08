import React from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@riotworks/ui'
import { StatusIndicator, SystemStatus } from './StatusIndicator'

export interface UniverseExperience {
  id: string
  number: string
  name: string
  classification: string
  role: string
  status: SystemStatus
  statusLabel?: string
  boundary: string
  href?: string
}

export interface UniverseCardProps {
  experience: UniverseExperience
}

export function UniverseCard({ experience }: UniverseCardProps) {
  return (
    <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800/10 rounded-full blur-2xl group-hover:bg-slate-700/20 transition-all pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono tracking-wider text-slate-500 uppercase">
            Experience {experience.number} &bull; {experience.classification}
          </span>
          <StatusIndicator status={experience.status} label={experience.statusLabel} />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight text-white font-mono flex items-center justify-between">
          <span>{experience.name}</span>
        </CardTitle>
        <CardDescription className="text-sm text-slate-400 mt-2 leading-relaxed">
          {experience.role}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="rounded border border-slate-800/80 bg-slate-950/40 p-3 text-xs font-mono">
          <div className="text-slate-500 text-[10px] uppercase mb-1">Domain Boundary</div>
          <div className="text-slate-300 truncate">{experience.boundary}</div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-500">
        <span>Public Gateway</span>
        {experience.href ? (
          <a
            href={experience.href}
            className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            Enter Portal &rarr;
          </a>
        ) : (
          <span className="text-slate-500 cursor-not-allowed">Target Spec &rarr;</span>
        )}
      </CardFooter>
    </Card>
  )
}
