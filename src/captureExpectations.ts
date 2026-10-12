/* TT-40: pure operator-authored rules over supplied snapshots, NOT application tests. */
import {validateBehaviorCapture,type BehaviorCapture} from "./behaviorCapture";
import {validateBehaviorStudy,type BehaviorStudy} from "./behaviorLab";

export const EXPECTATION_MAX_RULES=32;
export type ExpectationOperator="equals"|"differs"|"present"|"absent";
export type CaptureExpectation={
 id:string;key:string;operator:ExpectationOperator;expected:string|null;
};
export type ExpectationPlan={
 schema:"thinktank.capture-expectations.v1";kind:"operator-authored-review";
 studyId:string;traceId:string;target:string;rules:CaptureExpectation[];
 verified:false;executionAuthority:false;
};
export type EvaluationStatus="AGREES_WITH_RULE"|"CONTRADICTS_RULE"|"NOT_CAPTURED";
export type EvaluatedExpectation=CaptureExpectation&{observed:string|null;status:EvaluationStatus};
export type ExpectationEvaluation={
 schema:"thinktank.capture-expectation-evaluation.v1";
 status:"CAPTURE_ONLY_NOT_AN_APPLICATION_TEST";
 studyId:string;traceId:string;target:string;
 results:EvaluatedExpectation[];
 counts:{agrees:number;contradicts:number;notCaptured:number};
 evidenceVerified:false;targetExecuted:false;executionAuthority:false;
};
const ruleKeys=["id","key","operator","expected"];
const planKeys=["schema","kind","studyId","traceId","target","rules","verified","executionAuthority"];
function object(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==="object"&&!Array.isArray(x);
}
function shape(x:Record<string,unknown>,keys:string[],why:string){
 if(Object.keys(x).sort().join("|")!==[...keys].sort().join("|"))
  throw Error("EXPECTATION_INVALID_"+why+"_FIELDS");
}
function validRule(value:unknown):CaptureExpectation{
 if(!object(value))throw Error("EXPECTATION_INVALID_RULE");
 shape(value,ruleKeys,"RULE");
 if(typeof value.id!=="string"||!/^RULE-[\w-]{8,80}$/.test(value.id))
  throw Error("EXPECTATION_INVALID_RULE_ID");
 if(typeof value.key!=="string"||value.key.length>80||
   !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value.key))
  throw Error("EXPECTATION_INVALID_KEY");
 if(!["equals","differs","present","absent"].includes(value.operator as string))
  throw Error("EXPECTATION_INVALID_OPERATOR");
 const operator=value.operator as ExpectationOperator;
 if(operator==="equals"||operator==="differs"){
  if(typeof value.expected!=="string"||value.expected.length<1||
    value.expected.length>1000||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.expected))
   throw Error("EXPECTATION_INVALID_EXPECTED");
 }else if(value.expected!==null)throw Error("EXPECTATION_EXPECTED_MUST_BE_NULL");
 return {id:value.id,key:value.key,operator,expected:value.expected as string|null};
}
export function createExpectationPlan(study:BehaviorStudy,traceId:string):ExpectationPlan{
 const safe=validateBehaviorStudy(study);
 if(!safe.steps.some(s=>s.id===traceId))throw Error("EXPECTATION_UNKNOWN_TRACE");
 return {schema:"thinktank.capture-expectations.v1",kind:"operator-authored-review",
  studyId:safe.id,traceId,target:safe.target,rules:[],
  verified:false,executionAuthority:false};
}
export function validateExpectationPlan(value:unknown):ExpectationPlan{
 if(!object(value))throw Error("EXPECTATION_INVALID_PLAN");
 shape(value,planKeys,"PLAN");
 if(value.verified!==false||value.executionAuthority!==false)
  throw Error("EXPECTATION_AUTHORITY_REFUSED");
 if(value.schema!=="thinktank.capture-expectations.v1"||
  value.kind!=="operator-authored-review")throw Error("EXPECTATION_INVALID_SCHEMA");
 if(typeof value.studyId!=="string"||!/^STUDY-[\w-]{8,80}$/.test(value.studyId)||
  typeof value.traceId!=="string"||!/^STEP-[\w-]{8,80}$/.test(value.traceId)||
  typeof value.target!=="string"||value.target.trim().length<3||
  value.target.length>120)throw Error("EXPECTATION_INVALID_CONTEXT");
 if(!Array.isArray(value.rules)||value.rules.length>EXPECTATION_MAX_RULES)
  throw Error("EXPECTATION_RULE_LIMIT");
 const rules=value.rules.map(validRule);
 if(new Set(rules.map(r=>r.id)).size!==rules.length)throw Error("EXPECTATION_DUPLICATE_RULE");
 return {schema:"thinktank.capture-expectations.v1",kind:"operator-authored-review",
  studyId:value.studyId,traceId:value.traceId,target:value.target,
  rules,verified:false,executionAuthority:false};
}
export function appendCaptureExpectation(plan:ExpectationPlan,rule:CaptureExpectation):ExpectationPlan{
 const safe=validateExpectationPlan(plan);
 if(safe.rules.length>=EXPECTATION_MAX_RULES)throw Error("EXPECTATION_RULE_LIMIT");
 const checked=validRule(rule);
 if(safe.rules.some(r=>r.id===checked.id))throw Error("EXPECTATION_DUPLICATE_RULE");
 return {...safe,rules:[...safe.rules,checked]};
}
export function evaluateCaptureExpectations(
 plan:ExpectationPlan,candidate:BehaviorCapture
):ExpectationEvaluation{
 const rules=validateExpectationPlan(plan);
 const capture=validateBehaviorCapture(candidate);
 if(rules.studyId!==capture.studyId||rules.traceId!==capture.traceId||
  rules.target!==capture.target)throw Error("EXPECTATION_CONTEXT_MISMATCH");
 if(rules.rules.length===0)throw Error("EXPECTATION_NO_RULES");
 const observations=new Map(capture.observations.map(o=>[o.key,o.value]));
 const results:EvaluatedExpectation[]=rules.rules.map(rule=>{
  const observed=observations.get(rule.key)??null;
  let status:EvaluationStatus;
  if(rule.operator==="absent"){
   status=observed===null?"AGREES_WITH_RULE":"CONTRADICTS_RULE";
  }else if(observed===null){
   status="NOT_CAPTURED";
  }else if(rule.operator==="present"){
   status="AGREES_WITH_RULE";
  }else if(rule.operator==="equals"){
   status=observed===rule.expected?"AGREES_WITH_RULE":"CONTRADICTS_RULE";
  }else{
   status=observed!==rule.expected?"AGREES_WITH_RULE":"CONTRADICTS_RULE";
  }
  return {...rule,observed,status};
 });
 return {schema:"thinktank.capture-expectation-evaluation.v1",
  status:"CAPTURE_ONLY_NOT_AN_APPLICATION_TEST",
  studyId:rules.studyId,traceId:rules.traceId,target:rules.target,results,
  counts:{
   agrees:results.filter(r=>r.status==="AGREES_WITH_RULE").length,
   contradicts:results.filter(r=>r.status==="CONTRADICTS_RULE").length,
   notCaptured:results.filter(r=>r.status==="NOT_CAPTURED").length
  },
  evidenceVerified:false,targetExecuted:false,executionAuthority:false
 };
}
export function exportCaptureEvaluation(
 plan:ExpectationPlan,evaluation:ExpectationEvaluation,candidateSha256:string
):string{
 const safe=validateExpectationPlan(plan);
 if(!/^[a-f0-9]{64}$/.test(candidateSha256))throw Error("EXPECTATION_INVALID_DIGEST");
 // Recompute shape-sensitive fields to avoid accepting forged summary authority.
 if(evaluation.status!=="CAPTURE_ONLY_NOT_AN_APPLICATION_TEST"||
  evaluation.evidenceVerified!==false||evaluation.targetExecuted!==false||
  evaluation.executionAuthority!==false||evaluation.studyId!==safe.studyId||
  evaluation.traceId!==safe.traceId||evaluation.target!==safe.target)
  throw Error("EXPECTATION_AUTHORITY_REFUSED");
 return JSON.stringify({
  schema:"thinktank.capture-expectations-report.v1",
  kind:"operator-supplied-capture-rule-review",
  plan:safe,
  evaluation,
  candidateSha256,
  warning:"Rules were evaluated against operator-supplied strings, NOT an application. Hash identifies bytes, NOT their truth, origin or permission.",
  testsPassed:false,evidenceVerified:false,executionAuthority:false
 },null,2);
}
