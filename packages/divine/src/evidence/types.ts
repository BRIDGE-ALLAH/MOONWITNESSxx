import type {OntologyScope} from "../ontology/types.ts";
import type {CorpusRelease} from "../corpus/types.ts";
export type EvidenceRelation="supports"|"challenges"|"qualifies"|"contextualizes"|"quotes"|"mentions";
export type EvidenceNodeKind="claim"|"evidence"|"source"|"resource";
export type RetrievalRelevance="exact-match"|"near-parallel"|"related-transmission"|"semantic-support"|"context-mention"|"non-relevant";
export interface EvidenceNode {readonly id:string;readonly kind:EvidenceNodeKind;readonly canonicalRef?:string;readonly witnessFamilyRef?:string;readonly scope?:OntologyScope;readonly selector?:Readonly<Record<string,string|number>>;readonly provenanceRefs?:readonly string[]}
export interface SourceIndependenceAssessment {readonly outcome:"independent"|"dependent"|"unknown";readonly methodId:string;readonly assessorRef?:string;readonly rationale:string;readonly evidenceRefs:readonly string[]}
export interface EvidenceEdge {readonly id:string;readonly from:string;readonly to:string;readonly relation:EvidenceRelation;readonly sourceRefs:readonly string[];readonly provenanceRefs:readonly string[];readonly selector?:Readonly<Record<string,string|number>>;readonly methodId?:string;readonly sourceIndependence?:SourceIndependenceAssessment}
export interface EvidenceGraph {readonly id:string;readonly corpusRelease:CorpusRelease;readonly nodes:readonly EvidenceNode[];readonly edges:readonly EvidenceEdge[]}
export interface EvidencePath {readonly nodeRefs:readonly string[];readonly edgeRefs:readonly string[];readonly relations:readonly EvidenceRelation[];readonly sourceRefs:readonly string[];readonly provenanceRefs:readonly string[]}
export interface EvidenceGraphIssue {readonly code:"DUPLICATE_NODE"|"DUPLICATE_EDGE"|"MISSING_ENDPOINT"|"EMPTY_PROVENANCE"|"INVALID_INDEPENDENCE";readonly ref:string;readonly message:string}
export interface ContradictionView {readonly claimRefs:readonly string[];readonly challengeEdgeRefs:readonly string[];readonly unresolved:true}
