import type {ReasoningInput,ReasoningResult,DerivedConclusion} from "./types.ts";
const scopeFits=(required:Readonly<Record<string,string>>,actual:Readonly<Record<string,string>>)=>Object.entries(required).every(([k,v])=>actual[k]===v);
const canonicalScope=(scope:Readonly<Record<string,string>>)=>JSON.stringify(Object.fromEntries(Object.entries(scope).sort(([a],[b])=>a.localeCompare(b))));
export function evaluateRules(input:ReasoningInput):ReasoningResult{
 const byClaim=new Map(input.premises.map(p=>[p.claimRef,p]));const diagnostics:ReasoningResult["diagnostics"][number][]=[];const conclusions:DerivedConclusion[]=[];
 const rules=[...input.rules].sort((a,b)=>a.id.localeCompare(b.id)||a.version.localeCompare(b.version));
 for(const rule of rules){if(rule.requires.length===0){diagnostics.push({code:"MISSING_PREMISE",ruleId:rule.id,message:"Rules must declare at least one premise"});continue}
 const found=rule.requires.map(ref=>byClaim.get(ref));if(found.some(x=>!x)){diagnostics.push({code:"MISSING_PREMISE",ruleId:rule.id,message:"One or more required premises are absent"});continue}
 const premises=found as NonNullable<typeof found[number]>[];if(premises.some(p=>!scopeFits(rule.scope,p.scope))||new Set(premises.map(p=>canonicalScope(p.scope))).size>1){diagnostics.push({code:"SCOPE_MISMATCH",ruleId:rule.id,message:"Premise scopes are incompatible with each other or the rule scope"});continue}
 if((rule.exceptions??[]).some(x=>byClaim.has(x))){diagnostics.push({code:"DEFEATED",ruleId:rule.id,message:"An explicit defeating exception is present"});continue}
 const scope={...premises[0].scope,...rule.scope};const evidenceRefs=[...new Set(premises.flatMap(p=>p.evidenceRefs))].sort();
 conclusions.push({id:rule.id+"@"+rule.version,claimRef:rule.conclusion,ruleId:rule.id,ruleVersion:rule.version,premiseIds:premises.map(p=>p.id).sort(),evidenceRefs,scope,defeasible:rule.defeasible,status:"active"});
 }
 const groups=new Map<string,DerivedConclusion[]>();for(const c of conclusions){const g=groups.get(c.claimRef)??[];g.push(c);groups.set(c.claimRef,g)}
 for(const [claim,items] of groups){const scopes=new Set(items.map(x=>canonicalScope(x.scope)));if(scopes.size>1)diagnostics.push({code:"CONFLICT",ruleId:items.map(x=>x.ruleId).sort().join(","),message:"Multiple scoped derivations exist for "+claim+"; none was silently selected"})}
 return {methodId:input.methodId,methodVersion:input.methodVersion,conclusions,diagnostics};
}
