'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'
import type { GovernanceSnapshotRecord, GovernanceSnapshotSummary } from '@riotworks/contract'
import { compileDecisionDebt } from '../decision-debt/engine'
import { createReplayCapsule, verifyReplayCapsule } from '../replay-capsule/engine'
import type { ReplayCapsule, ReplayVerification } from '../replay-capsule/types'
import { runScenario } from '../scenario-forge/engine'
import { assessGovernanceReadiness } from '../uncertainty-gate/engine'
import type { GovernanceGateInput } from '../uncertainty-gate/types'
import type { DecisionGraphSnapshot } from '../decision-graph/types'
import type { ScenarioDefinition, ScenarioMetric } from '../scenario-forge/types'
import {
  governanceGateDemo,
  governanceGraphDemo,
  replayBaselineDemo,
  replayScenarioDemo,
} from './demo-data'
import {
  archiveSnapshot,
  describeGovernanceError,
  getSnapshot,
  GovernanceApiError,
  listSnapshots,
} from './snapshot-client'
import { SnapshotComposer } from './snapshot-composer'

interface LabInput {
  graph: DecisionGraphSnapshot
  gateInput: GovernanceGateInput
  scenarioBaseline: readonly ScenarioMetric[]
  scenario: ScenarioDefinition
}

const demoInput: LabInput = {
  graph: governanceGraphDemo,
  gateInput: governanceGateDemo,
  scenarioBaseline: replayBaselineDemo,
  scenario: replayScenarioDemo,
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string; unauthenticated: boolean }
  | { status: 'ready'; snapshots: GovernanceSnapshotSummary[] }

export function GovernanceLab() {
  const [mode, setMode] = useState<'live' | 'demo'>('live')
  const [listState, setListState] = useState<ListState>({ status: 'loading' })
  const [selected, setSelected] = useState<GovernanceSnapshotRecord | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [capsule, setCapsule] = useState<ReplayCapsule | null>(null)
  const [verification, setVerification] = useState<ReplayVerification | null>(null)
  const [capsuleError, setCapsuleError] = useState<string | null>(null)
  const [capsuleBusy, setCapsuleBusy] = useState(false)

  const loadList = useCallback(async () => {
    setListState({ status: 'loading' })
    try {
      const { snapshots } = await listSnapshots()
      setListState({ status: 'ready', snapshots })
    } catch (error) {
      setListState({
        status: 'error',
        message: describeGovernanceError(error),
        unauthenticated: error instanceof GovernanceApiError && error.code === 'UNAUTHENTICATED',
      })
    }
  }, [])

  useEffect(() => {
    if (mode === 'live') void loadList()
  }, [mode, loadList])

  async function selectSnapshot(id: string) {
    setDetailBusy(true)
    setDetailError(null)
    try {
      const { snapshot } = await getSnapshot(id)
      setSelected(snapshot)
    } catch (error) {
      setDetailError(describeGovernanceError(error))
    } finally {
      setDetailBusy(false)
    }
  }

  async function archiveSelected() {
    if (!selected) return
    setActionError(null)
    try {
      const { snapshot } = await archiveSnapshot(selected.id)
      setSelected(snapshot)
      await loadList()
    } catch (error) {
      setActionError(describeGovernanceError(error))
    }
  }

  const active: LabInput | null = mode === 'demo' ? demoInput : selected
  const analysis = useMemo(() => {
    if (!active) return null
    const now = new Date()
    const scenarioResult = runScenario(active.scenarioBaseline, active.scenario)
    return {
      debt: compileDecisionDebt({ snapshot: active.graph, now }),
      gate: assessGovernanceReadiness(active.gateInput),
      scenarioResult,
    }
  }, [active])

  useEffect(() => {
    if (!active || !analysis) {
      setCapsule(null)
      setVerification(null)
      setCapsuleError(null)
      return
    }
    let cancelled = false
    setCapsuleBusy(true)
    setCapsuleError(null)
    createReplayCapsule(active.scenarioBaseline, active.scenario, analysis.scenarioResult)
      .then(async (created) => {
        const checked = await verifyReplayCapsule(created)
        if (!cancelled) {
          setCapsule(created)
          setVerification(checked)
          setCapsuleBusy(false)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setCapsuleError(
            error instanceof Error ? error.message : 'Replay capsule could not be created'
          )
          setCapsuleBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [active, analysis])

  const gate = analysis?.gate
  const statusVariant =
    gate?.status === 'blocked'
      ? 'destructive'
      : gate?.status === 'review_required'
        ? 'warning'
        : 'success'

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'demo' ? (
              <Badge variant="warning">DEMO // SYNTHETIC GOVERNANCE DATA</Badge>
            ) : (
              <Badge variant="success">LIVE // PERSISTED VIA ARSY</Badge>
            )}
            <button
              type="button"
              className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
              onClick={() => {
                setMode(mode === 'live' ? 'demo' : 'live')
                setComposerOpen(false)
              }}
            >
              {mode === 'live' ? 'View demonstration dataset' : 'Back to persisted snapshots'}
            </button>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            MOONWITNESS // TRUST INFRASTRUCTURE
          </p>
          <h1 className="font-display text-4xl uppercase md:text-6xl">Governance Lab</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Replay every scenario, compile decision debt, and make uncertainty visible before a
            human approves consequential work.
          </p>
          <p role="note" className="border border-warning/50 bg-warning/10 p-3 text-sm">
            {mode === 'demo'
              ? 'Synthetic fixtures only, kept client-side and never persisted. These engines are deterministic review aids, not ARSY authorization, cryptographic signatures, or production decisions.'
              : 'Engines run against snapshots persisted by the authenticated operator in ARSY. They remain deterministic review aids, not ARSY authorization, cryptographic signatures, or production decisions.'}
          </p>
        </header>

        {mode === 'live' && (
          <section className="space-y-3">
            {listState.status === 'loading' && (
              <p className="text-sm text-muted-foreground">
                Loading persisted governance snapshots…
              </p>
            )}
            {listState.status === 'error' && (
              <div
                role="alert"
                className="space-y-2 border border-destructive/50 bg-destructive/10 p-4 text-sm"
              >
                <p>{listState.message}</p>
                {listState.unauthenticated && (
                  <a href="/login" className="underline">
                    Go to operator login
                  </a>
                )}
                <button
                  type="button"
                  className="block border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
                  onClick={() => void loadList()}
                >
                  Retry
                </button>
              </div>
            )}
            {listState.status === 'ready' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="border border-border bg-muted px-4 py-2 text-xs font-mono uppercase hover:bg-muted/70"
                    onClick={() => setComposerOpen(true)}
                  >
                    Record new snapshot
                  </button>
                  <button
                    type="button"
                    className="border border-border px-4 py-2 text-xs font-mono uppercase hover:bg-muted"
                    onClick={() => void loadList()}
                  >
                    Refresh
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {listState.snapshots.length} persisted snapshot(s)
                  </span>
                </div>
                {listState.snapshots.length === 0 && !composerOpen && (
                  <Card>
                    <CardHeader>
                      <CardTitle>No persisted governance snapshots yet</CardTitle>
                      <CardDescription>
                        Record the real decision graph, evidence counters, and uncertainty ranges
                        for a decision under review. Nothing is shown here until an operator
                        persists it.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
                {listState.snapshots.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {listState.snapshots.map((summary) => (
                      <button
                        key={summary.id}
                        type="button"
                        onClick={() => void selectSnapshot(summary.id)}
                        className={`border p-3 text-left text-sm hover:bg-muted ${selected?.id === summary.id ? 'border-foreground' : 'border-border'}`}
                      >
                        <span className="block font-medium">{summary.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(summary.createdAt).toLocaleString()}
                        </span>
                        {summary.archivedAt && <Badge variant="outline">ARCHIVED</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {detailBusy && <p className="text-sm text-muted-foreground">Loading snapshot…</p>}
            {detailError && (
              <p role="alert" className="text-sm text-destructive">
                {detailError}
              </p>
            )}
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            {composerOpen && (
              <SnapshotComposer
                onCancel={() => setComposerOpen(false)}
                onCreated={(snapshot) => {
                  setComposerOpen(false)
                  setSelected(snapshot)
                  void loadList()
                }}
              />
            )}
            {selected && !composerOpen && (
              <div className="flex flex-wrap items-center gap-2 border border-border p-3 text-sm">
                <Badge variant="outline">SNAPSHOT: {selected.id}</Badge>
                <span>Created {new Date(selected.createdAt).toLocaleString()}</span>
                {selected.archivedAt ? (
                  <Badge variant="outline">
                    ARCHIVED {new Date(selected.archivedAt).toLocaleString()}
                  </Badge>
                ) : (
                  <button
                    type="button"
                    className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
                    onClick={() => void archiveSelected()}
                  >
                    Archive snapshot
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {active && analysis && gate && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>REPLAY CAPSULE</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl">SHA-256</p>
                  <p className="text-xs text-muted-foreground">Content integrity + recomputation</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>DECISION DEBT</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl">{analysis.debt.findings.length}</p>
                  <p className="text-xs text-muted-foreground">Decision(s) requiring review</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>DOWNSTREAM IMPACT</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl">
                    {analysis.debt.affectedDownstreamNodeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Reachable affected nodes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>GOVERNANCE GATE</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={statusVariant}>
                    {gate.status.replaceAll('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Human approval always required
                  </p>
                </CardContent>
              </Card>
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display uppercase">11 // Replay Capsule</CardTitle>
                  <CardDescription>
                    Rebuild a scenario from its exact baseline and ordered operations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">SCENARIO: {active.scenario.id}</Badge>
                    <Badge variant="outline">ENGINE: 1.0.0</Badge>
                    {capsuleBusy ? (
                      <Badge>HASHING</Badge>
                    ) : verification?.valid ? (
                      <Badge variant="success">VERIFIED</Badge>
                    ) : (
                      <Badge variant="destructive">INVALID</Badge>
                    )}
                  </div>
                  <p className="break-all rounded border border-border bg-muted p-3 font-mono text-xs">
                    {capsule?.digest ?? 'Generating content digest…'}
                  </p>
                  {capsuleError && (
                    <p role="alert" className="text-sm text-destructive">
                      {capsuleError}
                    </p>
                  )}
                  {verification && (
                    <div className="space-y-1 text-sm">
                      <p>
                        Digest matches: <strong>{verification.digestMatches ? 'YES' : 'NO'}</strong>
                      </p>
                      <p>
                        Deterministic result matches:{' '}
                        <strong>{verification.resultMatches ? 'YES' : 'NO'}</strong>
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!capsule}
                    onClick={async () => {
                      if (!capsule) return
                      const checked = await verifyReplayCapsule(capsule)
                      setVerification(checked)
                    }}
                    className="border border-border px-4 py-2 text-xs font-mono uppercase hover:bg-muted disabled:opacity-40"
                  >
                    Verify capsule again
                  </button>
                  <p className="text-xs text-muted-foreground">
                    SHA-256 detects payload changes; without a trusted signature or timestamp
                    authority it does not prove who created the capsule or when.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-display uppercase">
                    12 // Decision Debt Compiler
                  </CardTitle>
                  <CardDescription>
                    Find active decisions whose rationale needs human review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total debt score</span>
                    <span className="font-display text-2xl">{analysis.debt.totalDebt}</span>
                  </div>
                  {analysis.debt.findings.map((finding) => (
                    <div key={finding.decisionId} className="space-y-2 border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{finding.decisionLabel}</strong>
                        <Badge
                          variant={
                            finding.severity === 'critical'
                              ? 'destructive'
                              : finding.severity === 'high'
                                ? 'warning'
                                : 'outline'
                          }
                        >
                          {finding.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Reasons: {finding.reasons.join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Stale evidence: {finding.staleEvidenceIds.join(', ') || 'None'} ·
                        Contradictions: {finding.contradictoryEvidenceIds.join(', ') || 'None'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Downstream impact: {finding.downstreamNodeIds.join(', ') || 'None'}
                      </p>
                    </div>
                  ))}
                  {analysis.debt.findings.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No decision debt detected in this snapshot.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Scores prioritize review; they are not probabilities or an automated verdict.
                  </p>
                </CardContent>
              </Card>
            </section>
            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display uppercase">
                    13 // Uncertainty Envelope
                  </CardTitle>
                  <CardDescription>
                    Ranges, not false precision. Epistemic uncertainty remains explicit.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {active.gateInput.metrics.map((metric) => (
                    <div key={metric.id} className="space-y-1">
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong className="text-sm">{metric.label}</strong>
                        <Badge
                          variant={metric.sourceQuality === 'verified' ? 'success' : 'warning'}
                        >
                          {metric.sourceQuality.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="font-mono text-sm">
                        {metric.low} – {metric.base} – {metric.high} {metric.unit}
                      </p>
                      <p className="text-xs text-muted-foreground">Low · Base · High</p>
                    </div>
                  ))}
                  {active.gateInput.metrics.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No uncertainty metrics recorded in this snapshot.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-display uppercase">Governance Gate</CardTitle>
                  <CardDescription>
                    Eligibility for a human review, never autonomous approval.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge variant={statusVariant}>
                    {gate.status.replaceAll('_', ' ').toUpperCase()}
                  </Badge>
                  <p className="text-sm">
                    Evidence coverage: {Math.round(gate.evidenceCoverage * 100)}%
                  </p>
                  <p className="text-sm">
                    Maximum relative range: {Math.round(gate.maximumRelativeRange * 100)}%
                  </p>
                  {gate.reasons.map((reason) => (
                    <div key={reason.code} className="border-l-2 border-warning pl-3 text-sm">
                      <strong>{reason.code.replaceAll('_', ' ')}</strong>
                      <p className="text-muted-foreground">{reason.message}</p>
                    </div>
                  ))}
                  <p className="border border-border p-3 text-sm">
                    Human approval is mandatory even when the gate is eligible. ARSY must enforce
                    identity, permission, policy, and audit.
                  </p>
                </CardContent>
              </Card>
            </section>
          </>
        )}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          {mode === 'demo'
            ? 'Demonstration dataset · client-side only · never persisted · no mutation capability.'
            : 'Snapshots persisted through the authenticated ARSY governance API · owner-scoped · immutable payloads with soft archive.'}
        </footer>
      </div>
    </main>
  )
}
