'use client'

import React, { useState } from 'react'
import {
  STANDARD_PLAYBOOKS,
  executePlaybookPipeline,
  type PlaybookDefinition,
  type PipelineExecutionReport,
} from '../lib/playbookPipeline'

export function PlaybookPipelineRunner() {
  const [selectedPlaybook, setSelectedPlaybook] = useState<PlaybookDefinition>(
    STANDARD_PLAYBOOKS[0]
  )
  const [isDryRun, setIsDryRun] = useState(true)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<PipelineExecutionReport | null>(null)

  const handleRun = async () => {
    setRunning(true)
    setReport(null)
    try {
      const res = await executePlaybookPipeline(selectedPlaybook, { dryRun: isDryRun })
      setReport(res)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            Action Automation & Playbook Pipeline
          </h3>
          <p className="text-xs text-muted-foreground">
            Multi-stage orchestrated runbook runner with automated rollback & dry-run validation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              className="rounded border-border/40"
            />
            Dry-Run Mode
          </label>
          <button
            onClick={handleRun}
            disabled={running}
            className={`px-3 py-1.5 text-xs font-semibold rounded shadow-sm transition-colors ${
              isDryRun
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {running ? 'Executing...' : isDryRun ? 'Validate (Dry-Run)' : 'Execute Playbook'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Select Playbook</label>
          <div className="space-y-1.5">
            {STANDARD_PLAYBOOKS.map((pb) => (
              <div
                key={pb.id}
                onClick={() => setSelectedPlaybook(pb)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                  selectedPlaybook.id === pb.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border/30 bg-muted/10 hover:bg-muted/30'
                }`}
              >
                <div className="font-semibold text-foreground">{pb.title}</div>
                <div className="text-muted-foreground text-[11px] mt-0.5">{pb.description}</div>
                <div className="text-[10px] text-muted-foreground/80 mt-1">
                  Stages: {pb.steps.length} | Target: {pb.targetEnv.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Pipeline Stages</label>
          <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2 max-h-56 overflow-y-auto">
            {selectedPlaybook.steps.map((st, i) => (
              <div
                key={st.id}
                className="text-xs border-b border-border/20 last:border-b-0 pb-2 last:pb-0"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-medium text-foreground">
                    {i + 1}. {st.name}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${st.critical ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}
                  >
                    {st.critical ? 'CRITICAL' : 'OPTIONAL'}
                  </span>
                </div>
                <div className="text-muted-foreground text-[11px] mt-0.5">{st.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {report && (
        <div className="p-3 bg-card border border-border/40 rounded-lg space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <span className="font-semibold text-foreground">
              Execution Summary [{report.pipelineId}]
            </span>
            <span
              className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                report.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {report.success ? 'SUCCESS' : 'FAILED'} (Duration: {report.totalDurationMs}ms)
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {report.executedSteps.map((s, idx) => (
              <div key={idx} className="text-muted-foreground">
                <span className="text-emerald-400">✔</span> [{s.stepId}] {s.output} ({s.durationMs}
                ms)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
