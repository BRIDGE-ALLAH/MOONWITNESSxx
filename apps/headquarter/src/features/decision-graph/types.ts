/**
 * Decision Graph: an explainability/provenance model for decisions.
 * This is a domain contract only; it is not an audit log or a source of truth.
 */
export type DecisionNodeKind = 'decision' | 'evidence' | 'policy' | 'actor' | 'action' | 'outcome'

export type DecisionRelation =
  | 'supports'
  | 'contradicts'
  | 'constrained_by'
  | 'made_by'
  | 'causes'
  | 'supersedes'

export type DecisionProvenance = {
  sourceType: 'api' | 'document' | 'event' | 'human' | 'system'
  sourceRef: string
  capturedAt: string
}

export type DecisionGraphNode = {
  id: string
  kind: DecisionNodeKind
  label: string
  createdAt: string
  provenance?: DecisionProvenance
  confidence?: number
  validUntil?: string
}

export type DecisionGraphEdge = {
  id: string
  from: string
  to: string
  relation: DecisionRelation
  provenance?: DecisionProvenance
}

export type DecisionGraphSnapshot = {
  id: string
  version: number
  createdAt: string
  nodes: DecisionGraphNode[]
  edges: DecisionGraphEdge[]
}

export type DecisionGraphIssueCode =
  | 'duplicate_node_id'
  | 'duplicate_edge_id'
  | 'dangling_edge'
  | 'missing_evidence_provenance'
  | 'invalid_confidence'
  | 'expired_evidence'
  | 'unsubstantiated_decision'

export type DecisionGraphIssue = {
  code: DecisionGraphIssueCode
  message: string
  nodeId?: string
  edgeId?: string
}

export type DecisionGraphAssessment = {
  traceableDecisions: number
  unsubstantiatedDecisions: number
  expiredEvidence: number
  integrityIssues: DecisionGraphIssue[]
  traceability: number
}
