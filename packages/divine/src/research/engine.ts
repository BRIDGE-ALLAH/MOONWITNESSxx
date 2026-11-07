import type {ResearchPlan,RetrievalCandidate,ResearchManifest,ResearchReport} from "./types.ts";
export function rankResearchCandidates(candidates:readonly RetrievalCandidate[]):RetrievalCandidate[]{
 const rank={"exact-id":0,citation:1,structural:2,lexical:3,semantic:4} as const;
 return [...candidates].sort((a,b)=>rank[a.channel]-rank[b.channel]||(b.score??0)-(a.score??0)||a.id.localeCompare(b.id));
}
async function digestCanonical(value:string):Promise<string>{
 const bytes=new TextEncoder().encode(value);const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function createResearchManifest(input:{plan:ResearchPlan;candidates:readonly RetrievalCandidate[];softwareVersion:string;generatedAt:string;limitations?:readonly string[]}):Promise<ResearchManifest>{
 const ordered=rankResearchCandidates(input.candidates);const limitations=[...(input.limitations??[])];
 const canonical=JSON.stringify({plan:input.plan,candidates:ordered,softwareVersion:input.softwareVersion,generatedAt:input.generatedAt,limitations});
 const inputDigest=await digestCanonical(canonical);
 return {plan:input.plan,softwareVersion:input.softwareVersion,generatedAt:input.generatedAt,inputDigest,selectedCandidateIds:ordered.map(x=>x.id),limitations};
}
export async function buildResearchReport(input:{plan:ResearchPlan;candidates:readonly RetrievalCandidate[];softwareVersion:string;generatedAt:string;limitations?:readonly string[]}):Promise<ResearchReport>{
 const candidates=rankResearchCandidates(input.candidates);const warnings:string[]=[];
 for(const c of candidates){if(!c.sourceRef||!c.passageRef||c.evidenceRefs.length===0)warnings.push("Candidate "+c.id+" lacks complete source/passage/evidence attribution");if(c.channel==="semantic"&&!c.method)warnings.push("Semantic candidate "+c.id+" does not disclose its retrieval method");}
 return {manifest:await createResearchManifest({...input,candidates}),candidates,warnings};
}
export async function validateResearchManifest(manifest:ResearchManifest,candidates:readonly RetrievalCandidate[]):Promise<boolean>{
 const rebuilt=await createResearchManifest({plan:manifest.plan,candidates,softwareVersion:manifest.softwareVersion,generatedAt:manifest.generatedAt,limitations:manifest.limitations});
 return rebuilt.inputDigest===manifest.inputDigest&&JSON.stringify(rebuilt.selectedCandidateIds)===JSON.stringify(manifest.selectedCandidateIds);
}
