export type ImpactNode = { id: string; label: string; criticality: number }
export type ImpactEdge = { id: string; from: string; to: string; relation: 'causes' | 'supports' | 'contradicts' | 'constrained_by' | 'made_by' | 'supersedes' }
export type ImpactGraph = { nodes: ImpactNode[]; edges: ImpactEdge[] }
export type BlastRadiusEntry = { nodeId: string; label: string; depth: number; criticality: number; impactScore: number }
export type BlastRadiusReport = { valid: boolean; seedIds: string[]; impacted: BlastRadiusEntry[]; maximumDepth: number; aggregateImpact: number; cycleDetected: boolean; reason?: string }
