import test from "node:test";import assert from "node:assert/strict";import {compareScope,evaluateEpistemicInput,createEpistemicPolicy} from "../src/epistemology/index.ts";
const policy=createEpistemicPolicy({id:"sidrat-default",version:"1.0.0",allowNarrowing:true,prohibitedQuestionClasses:["metaphysical","normative"],requireProvenance:true});
const scope={tradition:"mw:tradition:a"};const input=(overrides={})=>({query:{id:"q1",questionClass:"historical",requestedScope:scope},knowledgeState:"known-within-scope",claimScope:scope,disposition:"asserted",assessment:{methodId:"historical-comparison-v1",outcome:"sufficient",evidenceRefs:["mw:evidence:1"],rationale:"Evidence sufficient under this method"},provenanceRefs:["mw:provenance:1"],...overrides});
test("scope must match exactly unless explicit narrowing is enabled",()=>{assert.equal(compareScope(scope,scope,false),"exact");assert.equal(compareScope(scope,{...scope,community:"mw:community:a"},true),"narrower");assert.equal(compareScope(scope,{tradition:"mw:tradition:b"},true),"mismatch")});
test("answers only within scope with method evidence and provenance",()=>{assert.equal(evaluateEpistemicInput(input(),policy).outcome,"answer")});
test("unknown, not-recorded and not-applicable never become false",()=>{for(const state of ["unknown","not-recorded","not-applicable"]){const r=evaluateEpistemicInput(input({knowledgeState:state}),policy);assert.equal(r.outcome,"abstain");assert.notEqual(r.outcome==="answer"&&r.disposition,"denied")}});
test("metaphysical and normative questions abstain",()=>{for(const questionClass of ["metaphysical","normative"]){const r=evaluateEpistemicInput(input({query:{id:"q",questionClass,requestedScope:scope}}),policy);assert.equal(r.outcome,"abstain")}});
test("insufficient evidence and missing provenance abstain",()=>{assert.equal(evaluateEpistemicInput(input({assessment:{methodId:"m",outcome:"insufficient",evidenceRefs:[],rationale:""} }),policy).outcome,"abstain");assert.equal(evaluateEpistemicInput(input({provenanceRefs:[]}),policy).outcome,"abstain")});
test("unobservable and unverifiable states abstain with distinct reasons",()=>{assert.equal(evaluateEpistemicInput(input({knowledgeState:"unobservable"}),policy).reason,"UNOBSERVABLE");assert.equal(evaluateEpistemicInput(input({knowledgeState:"unverifiable"}),policy).reason,"UNVERIFIABLE")});
test("cross-tradition comparison requires explicit method and mapping",()=>{
  const rule={id:"cmp",methodId:"historical-comparison-v1",mappingRefs:["mw:assertion:map"],traditions:["mw:tradition:a","mw:tradition:b"]};
  const query={id:"q",questionClass:"historical",requestedScope:{tradition:"mw:tradition:b"},comparisonRule:rule};
  assert.equal(evaluateEpistemicInput(input({query}),policy).outcome,"answer");
  const noMappings={...query,comparisonRule:{...rule,mappingRefs:[]}};
  assert.equal(evaluateEpistemicInput(input({query:noMappings}),policy).reason,"CROSS_TRADITION_NOT_AUTHORIZED");
  const noRule={...query,comparisonRule:undefined};
  assert.equal(evaluateEpistemicInput(input({query:noRule}),policy).reason,"CROSS_TRADITION_NOT_AUTHORIZED");
});
test("claim scope cannot be widened by a broader request",()=>{const narrow={tradition:"mw:tradition:a",community:"mw:community:a"};const r=evaluateEpistemicInput(input({claimScope:narrow,query:{id:"q",questionClass:"historical",requestedScope:scope}}),policy);assert.equal(r.reason,"SCOPE_MISMATCH")});

test("unscoped claims cannot be promoted into scoped claims",()=>{const r=evaluateEpistemicInput(input({claimScope:{},query:{id:"q",questionClass:"historical",requestedScope:scope,allowNarrowing:true}}),policy);assert.equal(r.reason,"SCOPE_MISMATCH")});
test("metaphysical and normative boundaries cannot be disabled by a custom policy",()=>{const permissive=createEpistemicPolicy({id:"permissive",version:"1.0.0",allowNarrowing:false,prohibitedQuestionClasses:[],requireProvenance:false});assert.equal(evaluateEpistemicInput(input({query:{id:"q",questionClass:"normative",requestedScope:scope}}),permissive).reason,"NORMATIVE_VERDICT_PROHIBITED")});

test("property invariant: unknown-like states never become denial across all claim dispositions",()=>{for(const state of ["unknown","not-recorded","not-applicable"]){for(const disposition of ["asserted","denied","contested","not-assessed"]){const result=evaluateEpistemicInput(input({knowledgeState:state,disposition}),policy);assert.equal(result.outcome,"abstain");assert.equal(result.knowledgeState,state)}}const explicitDenial=evaluateEpistemicInput(input({knowledgeState:"known-within-scope",disposition:"denied"}),policy);assert.equal(explicitDenial.outcome,"answer");assert.equal(explicitDenial.outcome==="answer"&&explicitDenial.disposition,"denied")});
