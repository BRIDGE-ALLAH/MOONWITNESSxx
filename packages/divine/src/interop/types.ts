export interface InteropLoss {readonly code:string;readonly sourceRef:string;readonly detail:string}
export interface InteropReport {readonly standard:string;readonly version:string;readonly exported:number;readonly omitted:number;readonly losses:readonly InteropLoss[];readonly deterministic:true}
export interface ProvenanceNode {readonly id:string;readonly kind:"entity"|"activity"|"agent";readonly attributes?:Readonly<Record<string,string|number|boolean>>}
export interface ProvenanceRelation {readonly kind:"wasGeneratedBy"|"wasDerivedFrom"|"wasAssociatedWith"|"used";readonly subject:string;readonly object:string}
export interface ProvenanceGraph {readonly nodes:readonly ProvenanceNode[];readonly relations:readonly ProvenanceRelation[]}
export interface SkosExportInput {readonly schemeId:string;readonly concepts:readonly {id:string;labels:readonly {value:string;language:string}[];broader?:readonly string[];related?:readonly string[]}[]}
export interface TeiTextInput {readonly documentId:string;readonly title:string;readonly language:string;readonly sourceRef:string;readonly paragraphs:readonly {id:string;text:string}[]}
export interface IiifManifestInput {readonly id:string;readonly label:string;readonly pages:readonly {id:string;label:string;imageId:string;format?:string}[]}
export interface WebAnnotationInput {readonly id:string;readonly source:string;readonly start:number;readonly end:number;readonly exact:string;readonly prefix?:string;readonly suffix?:string;readonly body:string}