'use client'

import { useState } from 'react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@riotworks/ui'
import {
  governanceSnapshotInputSchema,
  type GovernanceSnapshotInput,
  type GovernanceSnapshotRecord,
} from '@riotworks/contract'
import { createSnapshot, describeGovernanceError } from './snapshot-client'

const nodeKinds = ['decision', 'evidence', 'policy', 'actor', 'action', 'outcome'] as const
const relations = [
  'supports',
  'contradicts',
  'constrained_by',
  'made_by',
  'causes',
  'supersedes',
] as const
const sourceQualities = ['verified', 'estimated', 'missing'] as const
const operations = ['set', 'add', 'multiply'] as const

interface NodeRow {
  id: string
  kind: (typeof nodeKinds)[number]
  label: string
}
interface EdgeRow {
  from: string
  to: string
  relation: (typeof relations)[number]
}
interface GateMetricRow {
  id: string
  label: string
  low: string
  base: string
  high: string
  unit: string
  sourceQuality: (typeof sourceQualities)[number]
}
interface BaselineRow {
  id: string
  label: string
  value: string
  unit: string
}
interface OperationRow {
  metricId: string
  operation: (typeof operations)[number]
  operand: string
  rationale: string
}

const inputClass = 'w-full border border-border bg-background px-2 py-1 text-sm'
const labelClass = 'text-xs font-mono uppercase tracking-wide text-muted-foreground'

function toNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value)
}

export function SnapshotComposer({
  onCreated,
  onCancel,
}: {
  onCreated: (snapshot: GovernanceSnapshotRecord) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [graphId, setGraphId] = useState('')
  const [nodes, setNodes] = useState<NodeRow[]>([{ id: 'decision-1', kind: 'decision', label: '' }])
  const [edges, setEdges] = useState<EdgeRow[]>([])
  const [gateMetrics, setGateMetrics] = useState<GateMetricRow[]>([
    {
      id: 'metric-1',
      label: '',
      low: '',
      base: '',
      high: '',
      unit: '',
      sourceQuality: 'estimated',
    },
  ])
  const [counters, setCounters] = useState({
    required: '0',
    verified: '0',
    stale: '0',
    contradictions: '0',
    assumptions: '0',
  })
  const [baseline, setBaseline] = useState<BaselineRow[]>([
    { id: 'metric-1', label: '', value: '', unit: '' },
  ])
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [assumptions, setAssumptions] = useState('')
  const [operationRows, setOperationRows] = useState<OperationRow[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setErrors([])
    setSubmitError(null)
    const now = new Date().toISOString()
    const resolvedGraphId = graphId.trim() || `graph-${now.slice(0, 10)}`
    const candidate: GovernanceSnapshotInput = {
      label,
      graph: {
        id: resolvedGraphId,
        version: 1,
        createdAt: now,
        nodes: nodes.map((node) => ({ ...node, createdAt: now })),
        edges: edges.map((edge, index) => ({ id: `edge-${index + 1}`, ...edge })),
      },
      gateInput: {
        metrics: gateMetrics.map((metric) => ({
          id: metric.id,
          label: metric.label,
          low: toNumber(metric.low),
          base: toNumber(metric.base),
          high: toNumber(metric.high),
          ...(metric.unit.trim() ? { unit: metric.unit.trim() } : {}),
          sourceQuality: metric.sourceQuality,
        })),
        requiredEvidenceCount: toNumber(counters.required),
        verifiedEvidenceCount: toNumber(counters.verified),
        staleEvidenceCount: toNumber(counters.stale),
        contradictionCount: toNumber(counters.contradictions),
        unresolvedAssumptionCount: toNumber(counters.assumptions),
      },
      scenarioBaseline: baseline.map((metric) => ({
        id: metric.id,
        label: metric.label,
        value: toNumber(metric.value),
        ...(metric.unit.trim() ? { unit: metric.unit.trim() } : {}),
      })),
      scenario: {
        id: `scenario-${resolvedGraphId}`,
        title: scenarioTitle,
        basedOnSnapshotId: resolvedGraphId,
        assumptions: assumptions
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        operations: operationRows.map((operation, index) => ({
          id: `op-${index + 1}`,
          metricId: operation.metricId,
          operation: operation.operation,
          operand: toNumber(operation.operand),
          rationale: operation.rationale,
        })),
      },
    }
    const parsed = governanceSnapshotInputSchema.safeParse(candidate)
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message))
      return
    }
    setSubmitting(true)
    try {
      const { snapshot } = await createSnapshot(parsed.data)
      onCreated(snapshot)
    } catch (error) {
      setSubmitError(describeGovernanceError(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display uppercase">Record a governance snapshot</CardTitle>
        <CardDescription>
          Persist real decision, evidence, and uncertainty inputs. The lab engines run against
          exactly what you save here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass} htmlFor="snapshot-label">
              Snapshot label
            </label>
            <input
              id="snapshot-label"
              className={inputClass}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Q4 distribution decision review"
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="graph-id">
              Decision graph id (optional)
            </label>
            <input
              id="graph-id"
              className={inputClass}
              value={graphId}
              onChange={(event) => setGraphId(event.target.value)}
              placeholder="auto-generated when empty"
            />
          </div>
        </div>

        <fieldset className="space-y-2 border border-border p-3">
          <legend className={labelClass}>Decision graph nodes</legend>
          {nodes.map((node, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
              <input
                aria-label={`Node ${index + 1} id`}
                className={inputClass}
                value={node.id}
                onChange={(event) =>
                  setNodes(
                    nodes.map((item, i) =>
                      i === index ? { ...item, id: event.target.value } : item
                    )
                  )
                }
                placeholder="id"
              />
              <select
                aria-label={`Node ${index + 1} kind`}
                className={inputClass}
                value={node.kind}
                onChange={(event) =>
                  setNodes(
                    nodes.map((item, i) =>
                      i === index ? { ...item, kind: event.target.value as NodeRow['kind'] } : item
                    )
                  )
                }
              >
                {nodeKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Node ${index + 1} label`}
                className={inputClass}
                value={node.label}
                onChange={(event) =>
                  setNodes(
                    nodes.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item
                    )
                  )
                }
                placeholder="label"
              />
              <button
                type="button"
                className="border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setNodes(nodes.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
            onClick={() =>
              setNodes([...nodes, { id: `node-${nodes.length + 1}`, kind: 'evidence', label: '' }])
            }
          >
            Add node
          </button>
        </fieldset>

        <fieldset className="space-y-2 border border-border p-3">
          <legend className={labelClass}>Decision graph edges</legend>
          {edges.map((edge, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <input
                aria-label={`Edge ${index + 1} from`}
                className={inputClass}
                value={edge.from}
                onChange={(event) =>
                  setEdges(
                    edges.map((item, i) =>
                      i === index ? { ...item, from: event.target.value } : item
                    )
                  )
                }
                placeholder="from node id"
              />
              <select
                aria-label={`Edge ${index + 1} relation`}
                className={inputClass}
                value={edge.relation}
                onChange={(event) =>
                  setEdges(
                    edges.map((item, i) =>
                      i === index
                        ? { ...item, relation: event.target.value as EdgeRow['relation'] }
                        : item
                    )
                  )
                }
              >
                {relations.map((relation) => (
                  <option key={relation} value={relation}>
                    {relation}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Edge ${index + 1} to`}
                className={inputClass}
                value={edge.to}
                onChange={(event) =>
                  setEdges(
                    edges.map((item, i) =>
                      i === index ? { ...item, to: event.target.value } : item
                    )
                  )
                }
                placeholder="to node id"
              />
              <button
                type="button"
                className="border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setEdges(edges.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
            onClick={() => setEdges([...edges, { from: '', to: '', relation: 'supports' }])}
          >
            Add edge
          </button>
        </fieldset>

        <fieldset className="space-y-2 border border-border p-3">
          <legend className={labelClass}>Uncertainty metrics (low · base · high)</legend>
          {gateMetrics.map((metric, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_1fr_auto]">
              <input
                aria-label={`Metric ${index + 1} id`}
                className={inputClass}
                value={metric.id}
                onChange={(event) =>
                  setGateMetrics(
                    gateMetrics.map((item, i) =>
                      i === index ? { ...item, id: event.target.value } : item
                    )
                  )
                }
                placeholder="id"
              />
              <input
                aria-label={`Metric ${index + 1} label`}
                className={inputClass}
                value={metric.label}
                onChange={(event) =>
                  setGateMetrics(
                    gateMetrics.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item
                    )
                  )
                }
                placeholder="label"
              />
              {(['low', 'base', 'high'] as const).map((field) => (
                <input
                  key={field}
                  aria-label={`Metric ${index + 1} ${field}`}
                  type="number"
                  step="any"
                  className={inputClass}
                  value={metric[field]}
                  onChange={(event) =>
                    setGateMetrics(
                      gateMetrics.map((item, i) =>
                        i === index ? { ...item, [field]: event.target.value } : item
                      )
                    )
                  }
                  placeholder={field}
                />
              ))}
              <input
                aria-label={`Metric ${index + 1} unit`}
                className={inputClass}
                value={metric.unit}
                onChange={(event) =>
                  setGateMetrics(
                    gateMetrics.map((item, i) =>
                      i === index ? { ...item, unit: event.target.value } : item
                    )
                  )
                }
                placeholder="unit"
              />
              <select
                aria-label={`Metric ${index + 1} source quality`}
                className={inputClass}
                value={metric.sourceQuality}
                onChange={(event) =>
                  setGateMetrics(
                    gateMetrics.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            sourceQuality: event.target.value as GateMetricRow['sourceQuality'],
                          }
                        : item
                    )
                  )
                }
              >
                {sourceQualities.map((quality) => (
                  <option key={quality} value={quality}>
                    {quality}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setGateMetrics(gateMetrics.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
            onClick={() =>
              setGateMetrics([
                ...gateMetrics,
                {
                  id: `metric-${gateMetrics.length + 1}`,
                  label: '',
                  low: '',
                  base: '',
                  high: '',
                  unit: '',
                  sourceQuality: 'estimated',
                },
              ])
            }
          >
            Add metric
          </button>
          <div className="grid gap-2 md:grid-cols-5">
            {(
              [
                ['required', 'Required evidence'],
                ['verified', 'Verified evidence'],
                ['stale', 'Stale evidence'],
                ['contradictions', 'Contradictions'],
                ['assumptions', 'Unresolved assumptions'],
              ] as const
            ).map(([field, text]) => (
              <div key={field} className="space-y-1">
                <label className={labelClass} htmlFor={`counter-${field}`}>
                  {text}
                </label>
                <input
                  id={`counter-${field}`}
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={counters[field]}
                  onChange={(event) => setCounters({ ...counters, [field]: event.target.value })}
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2 border border-border p-3">
          <legend className={labelClass}>Scenario baseline metrics</legend>
          {baseline.map((metric, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_1fr_auto]">
              <input
                aria-label={`Baseline ${index + 1} id`}
                className={inputClass}
                value={metric.id}
                onChange={(event) =>
                  setBaseline(
                    baseline.map((item, i) =>
                      i === index ? { ...item, id: event.target.value } : item
                    )
                  )
                }
                placeholder="id"
              />
              <input
                aria-label={`Baseline ${index + 1} label`}
                className={inputClass}
                value={metric.label}
                onChange={(event) =>
                  setBaseline(
                    baseline.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item
                    )
                  )
                }
                placeholder="label"
              />
              <input
                aria-label={`Baseline ${index + 1} value`}
                type="number"
                step="any"
                className={inputClass}
                value={metric.value}
                onChange={(event) =>
                  setBaseline(
                    baseline.map((item, i) =>
                      i === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
                placeholder="value"
              />
              <input
                aria-label={`Baseline ${index + 1} unit`}
                className={inputClass}
                value={metric.unit}
                onChange={(event) =>
                  setBaseline(
                    baseline.map((item, i) =>
                      i === index ? { ...item, unit: event.target.value } : item
                    )
                  )
                }
                placeholder="unit"
              />
              <button
                type="button"
                className="border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setBaseline(baseline.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
            onClick={() =>
              setBaseline([
                ...baseline,
                { id: `metric-${baseline.length + 1}`, label: '', value: '', unit: '' },
              ])
            }
          >
            Add baseline metric
          </button>
        </fieldset>

        <fieldset className="space-y-2 border border-border p-3">
          <legend className={labelClass}>What-if scenario (shadow-only)</legend>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="scenario-title">
              Scenario title
            </label>
            <input
              id="scenario-title"
              className={inputClass}
              value={scenarioTitle}
              onChange={(event) => setScenarioTitle(event.target.value)}
              placeholder="e.g. Reduce rework by tooling"
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="scenario-assumptions">
              Assumptions (one per line)
            </label>
            <textarea
              id="scenario-assumptions"
              className={inputClass}
              rows={2}
              value={assumptions}
              onChange={(event) => setAssumptions(event.target.value)}
            />
          </div>
          {operationRows.map((operation, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_2fr_auto]">
              <select
                aria-label={`Operation ${index + 1} metric`}
                className={inputClass}
                value={operation.metricId}
                onChange={(event) =>
                  setOperationRows(
                    operationRows.map((item, i) =>
                      i === index ? { ...item, metricId: event.target.value } : item
                    )
                  )
                }
              >
                <option value="">select metric</option>
                {baseline.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.id || '(empty id)'}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Operation ${index + 1} type`}
                className={inputClass}
                value={operation.operation}
                onChange={(event) =>
                  setOperationRows(
                    operationRows.map((item, i) =>
                      i === index
                        ? { ...item, operation: event.target.value as OperationRow['operation'] }
                        : item
                    )
                  )
                }
              >
                {operations.map((operation) => (
                  <option key={operation} value={operation}>
                    {operation}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Operation ${index + 1} operand`}
                type="number"
                step="any"
                className={inputClass}
                value={operation.operand}
                onChange={(event) =>
                  setOperationRows(
                    operationRows.map((item, i) =>
                      i === index ? { ...item, operand: event.target.value } : item
                    )
                  )
                }
                placeholder="operand"
              />
              <input
                aria-label={`Operation ${index + 1} rationale`}
                className={inputClass}
                value={operation.rationale}
                onChange={(event) =>
                  setOperationRows(
                    operationRows.map((item, i) =>
                      i === index ? { ...item, rationale: event.target.value } : item
                    )
                  )
                }
                placeholder="rationale"
              />
              <button
                type="button"
                className="border border-border px-2 text-xs hover:bg-muted"
                onClick={() => setOperationRows(operationRows.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="border border-border px-3 py-1 text-xs font-mono uppercase hover:bg-muted"
            onClick={() =>
              setOperationRows([
                ...operationRows,
                {
                  metricId: baseline[0]?.id ?? '',
                  operation: 'multiply',
                  operand: '',
                  rationale: '',
                },
              ])
            }
          >
            Add operation
          </button>
        </fieldset>

        {errors.length > 0 && (
          <div
            role="alert"
            className="space-y-1 border border-destructive/50 bg-destructive/10 p-3 text-sm"
          >
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="border border-border bg-muted px-4 py-2 text-xs font-mono uppercase hover:bg-muted/70 disabled:opacity-40"
          >
            {submitting ? 'Persisting…' : 'Persist snapshot'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="border border-border px-4 py-2 text-xs font-mono uppercase hover:bg-muted disabled:opacity-40"
          >
            Cancel
          </button>
          <Badge variant="outline">SERVER-VALIDATED · OWNER-SCOPED</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
