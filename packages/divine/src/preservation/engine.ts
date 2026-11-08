import type {DecisionLedgerEntry,IntegrityReport,PreservationInput,PreservationManifest,ResearchDecision,RightsAction,RightsPolicy} from "./types.ts";
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function digest(value:string){return hex(await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))}
export async function createPreservationManifest(input:PreservationInput):Promise<PreservationManifest>{
 if(!input.artifactRef||!input.corpusRelease||!input.contentDigest||!input.derivationMethod||!input.methodVersion||!input.createdAt)throw new Error("Preservation manifest is missing required lineage fields");
 if(input.sourceRefs.length===0)throw new Error("At least one source reference is required");
 const canonical=JSON.stringify({manifestVersion:"1",artifactRef:input.artifactRef,corpusRelease:input.corpusRelease,contentDigest:input.contentDigest,digestAlgorithm:input.digestAlgorithm,derivationMethod:input.derivationMethod,methodVersion:input.methodVersion,sourceRefs:[...input.sourceRefs].sort(),rightsPolicyRefs:[...input.rightsPolicyRefs].sort(),createdAt:input.createdAt});
 return {...input,manifestVersion:"1",manifestDigest:await digest(canonical)};
}
export async function verifyPreservationManifest(m:PreservationManifest):Promise<boolean>{
 const {manifestDigest,manifestVersion,...input}=m;const rebuilt=await createPreservationManifest(input);return rebuilt.manifestDigest===manifestDigest&&manifestVersion==="1";
}
export function evaluateRights(policy:RightsPolicy,action:RightsAction):"allow"|"metadata-only"|"deny"{return policy.decisions[action]??"deny"}
export function assertRights(policy:RightsPolicy,action:RightsAction,mode:"content"|"metadata"="content"):void{const d=evaluateRights(policy,action);if(d==="deny"||(d==="metadata-only"&&mode==="content"))throw new Error("Rights policy blocks "+action+" for "+policy.resourceRef)}
export async function appendDecision(entries:readonly DecisionLedgerEntry[],decision:ResearchDecision):Promise<DecisionLedgerEntry[]>{
 if(!decision.id||!decision.actorRef||!decision.role||!decision.method||!decision.rationale||!decision.occurredAt)throw new Error("Decision must include actor, role, method, rationale and timestamp");
 if(entries.some(x=>x.decision.id===decision.id))throw new Error("Decision IDs are append-only and unique");
 if(decision.kind==="correct"||decision.kind==="supersede"){if(!decision.supersedes)throw new Error("Corrections and supersessions must reference the prior decision");if(!entries.some(x=>x.decision.id===decision.supersedes))throw new Error("Correction target must exist in the append-only history");}
 const previousDigest=entries.at(-1)?.entryDigest??null;const entryDigest=await digest(JSON.stringify({decision,previousDigest}));
 return [...entries,{decision,previousDigest,entryDigest}];
}
export async function verifyDecisionLedger(entries:readonly DecisionLedgerEntry[]):Promise<IntegrityReport>{
 let previous:string|null=null;for(let i=0;i<entries.length;i++){const e=entries[i];if(e.previousDigest!==previous)return {valid:false,checkedEntries:i,firstInvalidIndex:i,reason:"Previous digest does not match chain"};const actual=await digest(JSON.stringify({decision:e.decision,previousDigest:previous}));if(actual!==e.entryDigest)return {valid:false,checkedEntries:i,firstInvalidIndex:i,reason:"Entry digest mismatch"};previous=e.entryDigest}return {valid:true,checkedEntries:entries.length};
}
