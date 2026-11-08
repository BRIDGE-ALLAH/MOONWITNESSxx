'use client'

import React, { useState } from 'react'
import type { NodeTelemetry } from '../lib/telemetry'
import type { NodeChange } from '../lib/snapshotDiff'

export interface TelemetryVisualizerProps {
  nodes: NodeTelemetry[]
  diffs: NodeChange[]
  environment: string
}

export function TelemetryVisualizer({ nodes, diffs, environment }: TelemetryVisualizerProps) {
  const [selectedMetric, setSelectedMetric] = useState<'latency' | 'status'>('latency')

  const avgLatency =
    nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + (n.latencyMs || 0), 0) / nodes.length)
      : 0

  const maxLatency = nodes.length > 0 ? Math.max(...nodes.map((n) => n.latencyMs || 0), 100) : 100

  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            Telemetry & Mesh Dynamics
          </h3>
          <p className="text-xs text-muted-foreground">
            Real-time latency distribution across nodes in [{environment.toUpperCase()}]
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedMetric('latency')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              selectedMetric === 'latency'
                ? 'bg-primary/20 border-primary text-primary font-medium'
                : 'border-border/40 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Latency (ms)
          </button>
          <button
            onClick={() => setSelectedMetric('status')}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              selectedMetric === 'status'
                ? 'bg-primary/20 border-primary text-primary font-medium'
                : 'border-border/40 text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Diffs ({diffs.length})
          </button>
        </div>
      </div>

      {selectedMetric === 'latency' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Cluster Average Latency: <strong className="text-foreground">{avgLatency} ms</strong>
            </span>
            <span>
              Peak: <strong className="text-foreground">{maxLatency} ms</strong>
            </span>
          </div>
          <div className="space-y-2">
            {nodes.map((node) => {
              const pct = Math.min(100, Math.max(5, (node.latencyMs / maxLatency) * 100))
              const isHigh = node.latencyMs > 150
              return (
                <div key={node.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{node.name}</span>
                    <span
                      className={`font-mono font-medium ${isHigh ? 'text-amber-400' : 'text-emerald-400'}`}
                    >
                      {node.latencyMs.toFixed(1)} ms
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        node.status === 'OFFLINE'
                          ? 'bg-red-500'
                          : isHigh
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {diffs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              No state delta detected between consecutive telemetry heartbeats.
            </p>
          ) : (
            diffs.map((diff, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded border border-border/30 bg-muted/20 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-foreground">{diff.name || diff.nodeId}</span>
                  <span className="text-muted-foreground ml-2">[{diff.kind}]</span>
                </div>
                <div className="font-mono text-[11px]">
                  <span className="text-red-400/80">{String(diff.from)}</span>
                  <span className="text-muted-foreground mx-1.5">➔</span>
                  <span className="text-emerald-400 font-bold">{String(diff.to)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
