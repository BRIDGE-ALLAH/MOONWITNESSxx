'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'
import { compileDecisionDebt } from '../decision-debt/engine'
import { createReplayCapsule, verifyReplayCapsule } from '../replay-capsule/engine'
import type { ReplayCapsule, ReplayVerification } from '../replay-capsule/types'
import { runScenario } from '../scenario-forge/engine'
import { assessGovernanceReadiness } from '../uncertainty-gate/engine'
import { governanceGateDemo, governanceGraphDemo, replayBaselineDemo, replayScenarioDemo } from './demo-data'

const evaluatedAt = new Date('2026-11-08T00:00:00.000Z')
const debtReport = compileDecisionDebt({ snapshot: governanceGraphDemo, now: evaluatedAt })
const gate = assessGovernanceReadiness(governanceGateDemo)
const result = runScenario(replayBaselineDemo, replayScenarioDemo)

export function GovernanceLab() {
  const [capsule, setCapsule] = useState<ReplayCapsule | null>(null)
  const [verification, setVerification] = useState<ReplayVerification | null>(null)
  const [capsuleError, setCapsuleError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  useEffect(() => {
    let active = true
    createReplayCapsule(replayBaselineDemo, replayScenarioDemo, result)
      .then(async (created) => {
        const checked = await verifyReplayCapsule(created)
        if (active) { setCapsule(created); setVerification(checked); setBusy(false) }
      })
      .catch((error: unknown) => {
        if (active) { setCapsuleError(error instanceof Error ? error.message : 'Replay capsule could not be created'); setBusy(false) }
      })
    return () => { active = false }
  }, [])
  const digest = useMemo(() => capsule?.digest ?? 'Generating content digest…', [capsule])
  const statusVariant = gate.status === 'blocked' ? 'destructive' : gate.status === 'review_required' ? 'warning' : 'success'

  return <main className="min-h-screen bg-background p-4 text-foreground md:p-8"><div className="mx-auto max-w-7xl space-y-7">
    <header className="space-y-3 border-b border-border pb-6"><Badge variant="warning">DEMO // SYNTHETIC GOVERNANCE DATA</Badge><p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">MOONWITNESS // TRUST INFRASTRUCTURE</p><h1 className="font-display text-4xl uppercase md:text-6xl">Governance Lab</h1><p className="max-w-3xl text-sm text-muted-foreground">Replay every scenario, compile decision debt, and make uncertainty visible before a human approves consequential work.</p><p role="note" className="border border-warning/50 bg-warning/10 p-3 text-sm">Synthetic fixtures only. These engines are deterministic review aids, not ARSY authorization, cryptographic signatures, or production decisions.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card><CardHeader className="pb-2"><CardDescription>REPLAY CAPSULE</CardDescription></CardHeader><CardContent><p className="font-display text-2xl">SHA-256</p><p className="text-xs text-muted-foreground">Content integrity + recomputation</p></CardContent></Card><Card><CardHeader className="pb-2"><CardDescription>DECISION DEBT</CardDescription></CardHeader><CardContent><p className="font-display text-3xl">{debtReport.findings.length}</p><p className="text-xs text-muted-foreground">Decision(s) requiring review</p></CardContent></Card><Card><CardHeader className="pb-2"><CardDescription>DOWNSTREAM IMPACT</CardDescription></CardHeader><CardContent><p className="font-display text-3xl">{debtReport.affectedDownstreamNodeCount}</p><p className="text-xs text-muted-foreground">Reachable affected nodes</p></CardContent></Card><Card><CardHeader className="pb-2"><CardDescription>GOVERNANCE GATE</CardDescription></CardHeader><CardContent><Badge variant={statusVariant}>{gate.status.replaceAll('_', ' ').toUpperCase()}</Badge><p className="mt-2 text-xs text-muted-foreground">Human approval always required</p></CardContent></Card></section>
    <section className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="font-display uppercase">11 // Replay Capsule</CardTitle><CardDescription>Rebuild a scenario from its exact baseline and ordered operations.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">SCENARIO: {replayScenarioDemo.id}</Badge><Badge variant="outline">ENGINE: 1.0.0</Badge>{busy ? <Badge>HASHING</Badge> : verification?.valid ? <Badge variant="success">VERIFIED</Badge> : <Badge variant="destructive">INVALID</Badge>}</div><p className="break-all rounded border border-border bg-muted p-3 font-mono text-xs">{digest}</p>{capsuleError && <p role="alert" className="text-sm text-destructive">{capsuleError}</p>}{verification && <div className="space-y-1 text-sm"><p>Digest matches: <strong>{verification.digestMatches ? 'YES' : 'NO'}</strong></p><p>Deterministic result matches: <strong>{verification.resultMatches ? 'YES' : 'NO'}</strong></p></div>}<button type="button" disabled={!capsule} onClick={async () => { if (!capsule) return; const checked = await verifyReplayCapsule(capsule); setVerification(checked) }} className="border border-border px-4 py-2 text-xs font-mono uppercase hover:bg-muted disabled:opacity-40">Verify capsule again</button><p className="text-xs text-muted-foreground">SHA-256 detects payload changes; without a trusted signature or timestamp authority it does not prove who created the capsule or when.</p></CardContent></Card>
    <Card><CardHeader><CardTitle className="font-display uppercase">12 // Decision Debt Compiler</CardTitle><CardDescription>Find active decisions whose rationale needs human review.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm">Total debt score</span><span className="font-display text-2xl">{debtReport.totalDebt}</span></div>{debtReport.findings.map((finding) => <div key={finding.decisionId} className="space-y-2 border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{finding.decisionLabel}</strong><Badge variant={finding.severity === 'critical' ? 'destructive' : finding.severity === 'high' ? 'warning' : 'outline'}>{finding.severity.toUpperCase()}</Badge></div><p className="text-xs text-muted-foreground">Reasons: {finding.reasons.join(', ')}</p><p className="text-xs text-muted-foreground">Stale evidence: {finding.staleEvidenceIds.join(', ') || 'None'} · Contradictions: {finding.contradictoryEvidenceIds.join(', ') || 'None'}</p><p className="text-xs text-muted-foreground">Downstream impact: {finding.downstreamNodeIds.join(', ') || 'None'}</p></div>)}{debtReport.findings.length === 0 && <p className="text-sm text-muted-foreground">No decision debt detected in this fixture.</p>}<p className="text-xs text-muted-foreground">Scores prioritize review; they are not probabilities or an automated verdict.</p></CardContent></Card></section>
    <section className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="font-display uppercase">13 // Uncertainty Envelope</CardTitle><CardDescription>Ranges, not false precision. Epistemic uncertainty remains explicit.</CardDescription></CardHeader><CardContent className="space-y-4">{governanceGateDemo.metrics.map((metric) => <div key={metric.id} className="space-y-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{metric.label}</strong><Badge variant={metric.sourceQuality === 'verified' ? 'success' : 'warning'}>{metric.sourceQuality.toUpperCase()}</Badge></div><p className="font-mono text-sm">{metric.low} – {metric.base} – {metric.high} {metric.unit}</p><p className="text-xs text-muted-foreground">Low · Base · High</p></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle className="font-display uppercase">Governance Gate</CardTitle><CardDescription>Eligibility for a human review, never autonomous approval.</CardDescription></CardHeader><CardContent className="space-y-3"><Badge variant={statusVariant}>{gate.status.replaceAll('_', ' ').toUpperCase()}</Badge><p className="text-sm">Evidence coverage: {Math.round(gate.evidenceCoverage * 100)}%</p><p className="text-sm">Maximum relative range: {Math.round(gate.maximumRelativeRange * 100)}%</p>{gate.reasons.map((reason) => <div key={reason.code} className="border-l-2 border-warning pl-3 text-sm"><strong>{reason.code.replaceAll('_', ' ')}</strong><p className="text-muted-foreground">{reason.message}</p></div>)}<p className="border border-border p-3 text-sm">Human approval is mandatory even when the gate is eligible. ARSY must enforce identity, permission, policy, and audit.</p></CardContent></Card></section>
    <footer className="border-t border-border pt-4 text-xs text-muted-foreground">Read-only reference implementation · no ARSY live contract · no persistence · no mutation capability.</footer>
  </div></main>
}
