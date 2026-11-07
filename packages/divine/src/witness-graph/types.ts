export type WitnessRelationKind = "supports" | "challenges" | "qualifies" | "contextualizes" | "quotes" | "mentions";
export type WitnessMatchClass = "exact" | "near-parallel" | "related-transmission" | "semantic-support" | "context-mention" | "non-relevant";
export interface WitnessNode { readonly id:string; readonly corpusId:string; readonly recordType:"assertion"|"evidence"|"provenance"|"assessment"|"source"; readonly selector?:string; readonly familyId?:string }
export interface WitnessEdge { readonly id:string; readonly from:string; readonly to:string; readonly relation:WitnessRelationKind; readonly matchClass?:WitnessMatchClass; readonly method?:string; readonly sourceRef:string; readonly provenanceRef:string; readonly note?:string }
export interface WitnessGraph { readonly corpusRelease:string; readonly methodVersion:string; readonly nodes:readonly WitnessNode[]; readonly edges:readonly WitnessEdge[] }
export interface WitnessPath { readonly nodeIds:readonly string[]; readonly edgeIds:readonly string[]; readonly provenanceRefs:readonly string[] }
export interface WitnessDiagnostic { readonly code:"DUPLICATE_NODE"|"DUPLICATE_EDGE"|"DANGLING_EDGE"|"MISSING_PROVENANCE"|"MISSING_SOURCE"|"INVALID_SELF_EDGE"; readonly id:string; readonly message:string }
