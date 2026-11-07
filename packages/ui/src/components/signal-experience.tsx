'use client'

import * as React from 'react'
import { cn } from '../lib/utils'

export interface RiotSignalNode {
  id: string
  label: string
  detail: string
  x: number
  y: number
  source?: string
  observedAt?: string
  confidence?: number
  evidence?: string
}

export interface RiotSignalLink {
  from: string
  to: string
  label?: string
}

export interface RiotSignalConstellationProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes: RiotSignalNode[]
  links?: RiotSignalLink[]
  selectedId?: string
  onSelect?: (node: RiotSignalNode) => void
  title?: React.ReactNode
  description?: React.ReactNode
  emptyLabel?: string
}

/**
 * Evidence-first relationship map. Coordinates and confidence are supplied by the host;
 * the component never infers relationships or invents telemetry.
 */
export function RiotSignalConstellation({
  nodes,
  links = [],
  selectedId,
  onSelect,
  title = 'Signal constellation',
  description = 'Select a signal to inspect its context and provenance.',
  emptyLabel = 'No signals in this constellation yet.',
  className,
  ...props
}: RiotSignalConstellationProps) {
  const [internalId, setInternalId] = React.useState(nodes[0]?.id ?? '')
  const activeId = selectedId ?? internalId
  const selected = nodes.find((node) => node.id === activeId) ?? nodes[0]
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const select = (node: RiotSignalNode) => {
    if (selectedId === undefined) setInternalId(node.id)
    onSelect?.(node)
  }
  const point = (value: number, max: number) => Math.max(0, Math.min(max, value))

  return (
    <section className={cn('riot-signal-constellation', className)} {...props}>
      <header className="riot-signal-constellation__header">
        <div>
          <p className="riot-signal-constellation__eyebrow">RELATIONSHIP FIELD / EVIDENCE MAP</p>
          <h3 className="riot-signal-constellation__title">{title}</h3>
          {description ? <p className="riot-signal-constellation__description">{description}</p> : null}
        </div>
        <span className="riot-signal-constellation__count">{String(nodes.length).padStart(2, '0')} NODES</span>
      </header>

      {nodes.length === 0 ? (
        <p className="riot-signal-constellation__empty">{emptyLabel}</p>
      ) : (
        <>
          <div className="riot-signal-constellation__field" aria-label="Signal relationship map">
            <svg className="riot-signal-constellation__links" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
              {links.map((link) => {
                const from = nodeById.get(link.from)
                const to = nodeById.get(link.to)
                if (!from || !to) return null
                return (
                  <g key={link.from + ':' + link.to}>
                    <line
                      x1={point(from.x, 1000)}
                      y1={point(from.y, 600)}
                      x2={point(to.x, 1000)}
                      y2={point(to.y, 600)}
                      className="riot-signal-constellation__line"
                    />
                    <circle cx={(point(from.x, 1000) + point(to.x, 1000)) / 2} cy={(point(from.y, 600) + point(to.y, 600)) / 2} r="4" className="riot-signal-constellation__link-point" />
                  </g>
                )
              })}
            </svg>
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={cn('riot-signal-constellation__node', activeId === node.id && 'is-selected')}
                style={{ left: (point(node.x, 1000) / 10) + '%', top: (point(node.y, 600) / 6) + '%' }}
                aria-pressed={activeId === node.id}
                aria-label={'Inspect signal: ' + node.label}
                onClick={() => select(node)}
              >
                <span className="riot-signal-constellation__node-core" aria-hidden="true" />
                <span className="riot-signal-constellation__node-label">{node.label}</span>
              </button>
            ))}
          </div>
          <div className="riot-signal-constellation__inspector" aria-live="polite">
            {selected ? (
              <>
                <div className="riot-signal-constellation__inspector-heading">
                  <div>
                    <p className="riot-signal-constellation__eyebrow">SELECTED SIGNAL / {selected.id}</p>
                    <h4>{selected.label}</h4>
                  </div>
                  {typeof selected.confidence === 'number' ? (
                    <span className="riot-signal-constellation__confidence">{Math.round(point(selected.confidence, 100))}% confidence</span>
                  ) : null}
                </div>
                <p className="riot-signal-constellation__detail">{selected.detail}</p>
                <div className="riot-signal-constellation__provenance">
                  {selected.source ? <span><b>Source</b>{selected.source}</span> : null}
                  {selected.observedAt ? <span><b>Observed</b>{selected.observedAt}</span> : null}
                  {selected.evidence ? <span><b>Evidence</b>{selected.evidence}</span> : null}
                </div>
                <p className="riot-signal-constellation__disclaimer">Relationships and confidence are host-provided evidence, not model-generated certainty.</p>
              </>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

export type RiotDecisionKind = 'observed' | 'interpreted' | 'decided' | 'actioned' | 'changed'

export interface RiotDecisionEvent {
  id: string
  kind: RiotDecisionKind
  title: string
  summary: string
  at: string
  actor?: string
  rationale?: string
  evidence?: string[]
}

export interface RiotDecisionTrailProps extends React.HTMLAttributes<HTMLDivElement> {
  events: RiotDecisionEvent[]
  selectedId?: string
  onSelect?: (event: RiotDecisionEvent) => void
  title?: React.ReactNode
  description?: React.ReactNode
  emptyLabel?: string
}

/**
 * Human-readable decision memory: lets operators inspect what changed and why,
 * without pretending that a UI timeline is a live event stream.
 */
export function RiotDecisionTrail({
  events,
  selectedId,
  onSelect,
  title = 'Decision trail',
  description = 'A traceable path from first observation to the latest action.',
  emptyLabel = 'No decision events recorded.',
  className,
  ...props
}: RiotDecisionTrailProps) {
  const [internalId, setInternalId] = React.useState(events[0]?.id ?? '')
  const activeId = selectedId ?? internalId
  const selected = events.find((event) => event.id === activeId) ?? events[0]
  const select = (event: RiotDecisionEvent) => {
    if (selectedId === undefined) setInternalId(event.id)
    onSelect?.(event)
  }

  return (
    <section className={cn('riot-decision-trail', className)} {...props}>
      <header className="riot-decision-trail__header">
        <div>
          <p className="riot-decision-trail__eyebrow">MEMORY / CHANGE / RATIONALE</p>
          <h3 className="riot-decision-trail__title">{title}</h3>
          {description ? <p className="riot-decision-trail__description">{description}</p> : null}
        </div>
        <span className="riot-decision-trail__count">{events.length} EVENTS</span>
      </header>
      {events.length === 0 ? (
        <p className="riot-decision-trail__empty">{emptyLabel}</p>
      ) : (
        <div className="riot-decision-trail__layout">
          <ol className="riot-decision-trail__list" aria-label="Decision events">
            {events.map((event, index) => (
              <li key={event.id} className="riot-decision-trail__item">
                <span className="riot-decision-trail__stem" aria-hidden="true" />
                <button
                  type="button"
                  className={cn('riot-decision-trail__event', activeId === event.id && 'is-selected')}
                  aria-current={activeId === event.id ? 'step' : undefined}
                  onClick={() => select(event)}
                >
                  <span className="riot-decision-trail__event-topline">
                    <span className="riot-decision-trail__kind">{event.kind}</span>
                    <span className="riot-decision-trail__time">{event.at}</span>
                  </span>
                  <span className="riot-decision-trail__event-title">{String(index + 1).padStart(2, '0')} / {event.title}</span>
                  <span className="riot-decision-trail__event-summary">{event.summary}</span>
                </button>
              </li>
            ))}
          </ol>
          {selected ? (
            <article className="riot-decision-trail__inspector" aria-live="polite">
              <p className="riot-decision-trail__eyebrow">WHY THIS MOMENT MATTERS</p>
              <h4>{selected.title}</h4>
              <p>{selected.summary}</p>
              {selected.rationale ? <blockquote>{selected.rationale}</blockquote> : null}
              {selected.actor ? <p className="riot-decision-trail__actor"><b>Owner</b>{selected.actor}</p> : null}
              {selected.evidence?.length ? (
                <div className="riot-decision-trail__evidence">
                  <b>Supporting evidence</b>
                  <ul>{selected.evidence.map((item, index) => <li key={selected.id + ':' + index}>{item}</li>)}</ul>
                </div>
              ) : null}
              <p className="riot-decision-trail__disclaimer">This trail reflects events supplied by the host system. It does not create or certify an audit record.</p>
            </article>
          ) : null}
        </div>
      )}
    </section>
  )
}
