import type {WitnessGraph,WitnessPath,WitnessDiagnostic,WitnessEdge} from "./types.ts";
export function validateWitnessGraph(graph:WitnessGraph):WitnessDiagnostic[]{
 const out:WitnessDiagnostic[]=[]; const nodes=new Set<string>(); const edges=new Set<string>();
 for(const n of graph.nodes){if(nodes.has(n.id))out.push({code:"DUPLICATE_NODE",id:n.id,message:"Node ID is duplicated"});nodes.add(n.id)}
 for(const e of graph.edges){if(edges.has(e.id))out.push({code:"DUPLICATE_EDGE",id:e.id,message:"Edge ID is duplicated"});edges.add(e.id);
 if(!nodes.has(e.from)||!nodes.has(e.to))out.push({code:"DANGLING_EDGE",id:e.id,message:"Edge endpoint does not exist"});
 if(e.from===e.to)out.push({code:"INVALID_SELF_EDGE",id:e.id,message:"Self edges are not allowed"});
 if(!e.sourceRef)out.push({code:"MISSING_SOURCE",id:e.id,message:"Every edge needs a source reference"});
 if(!e.provenanceRef)out.push({code:"MISSING_PROVENANCE",id:e.id,message:"Every edge needs provenance"});
 }
 return out;
}
export function traverseWitnessPaths(graph:WitnessGraph,startId:string,maxDepth=4):WitnessPath[]{
 if(!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>32)throw new RangeError("maxDepth must be an integer from 1 to 32");
 const known=new Set(graph.nodes.map(n=>n.id)); if(!known.has(startId))throw new Error("Unknown witness node");
 const adjacency=new Map<string,WitnessEdge[]>(); for(const edge of graph.edges){const list=adjacency.get(edge.from)??[];list.push(edge);adjacency.set(edge.from,list)}
 const results:WitnessPath[]=[]; const visit=(node:string,nodeIds:string[],edgeIds:string[],provenanceRefs:string[])=>{if(edgeIds.length>=maxDepth)return;for(const edge of adjacency.get(node)??[]){if(nodeIds.includes(edge.to))continue;const ns=[...nodeIds,edge.to],es=[...edgeIds,edge.id],ps=[...provenanceRefs,edge.provenanceRef];results.push({nodeIds:ns,edgeIds:es,provenanceRefs:ps});visit(edge.to,ns,es,ps)}};visit(startId,[startId],[],[]);return results;
}
export function serializeWitnessGraph(graph:WitnessGraph):string {
 const sort=(a:readonly {id:string}[])=>[...a].sort((x,y)=>x.id.localeCompare(y.id));
 return JSON.stringify({corpusRelease:graph.corpusRelease,methodVersion:graph.methodVersion,nodes:sort(graph.nodes),edges:sort(graph.edges)},null,2);
}
export function classifyWitnessRelation(input:{readonly matchClass:NonNullable<WitnessGraph["edges"][number]["matchClass"]>;readonly similarity?:number}):{readonly classification:string;readonly mayInferIdentity:false}{
 if(input.similarity!==undefined&&(!Number.isFinite(input.similarity)||input.similarity<0||input.similarity>1))throw new RangeError("similarity must be between 0 and 1");
 return {classification:input.matchClass,mayInferIdentity:false};
}
