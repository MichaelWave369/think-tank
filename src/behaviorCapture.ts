/* TT-39: explicit browser File uploads only. Pure comparator; no target access. */
import {validateBehaviorStudy,type BehaviorStudy,type BehaviorStep} from "./behaviorLab";

export const CAPTURE_MAX_BYTES=65536;
export const CAPTURE_MAX_OBSERVATIONS=48;
export type CaptureObservation={key:string;value:string};
export type BehaviorCapture={
 schema:"thinktank.behavior-capture.v1";kind:"operator-supplied";
 studyId:string;traceId:string;target:string;capturedAt:string;
 observations:CaptureObservation[];sourceVerified:false;testExecuted:false;
 executionAuthority:false;
};
export type BehaviorDifference={
 key:string;baseline:string|null;candidate:string|null;
 change:"UNCHANGED"|"CHANGED"|"ADDED"|"MISSING";
};
export type BehaviorComparison={
 schema:"thinktank.behavior-comparison.v1";
 status:"REVIEW_ONLY_NOT_A_TEST";
 studyId:string;traceId:string;target:string;
 differences:BehaviorDifference[];
 counts:{unchanged:number;changed:number;added:number;missing:number};
};

function record(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==="object"&&!Array.isArray(x);
}
function keys(x:Record<string,unknown>,expected:readonly string[],reason:string){
 if(Object.keys(x).sort().join("|")!==[...expected].sort().join("|"))
  throw Error("CAPTURE_INVALID_"+reason+"_FIELDS");
}
function bounded(x:unknown,field:string,max:number):string{
 if(typeof x!=="string"||x.trim().length<1||x.length>max||
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))
  throw Error("CAPTURE_INVALID_"+field.toUpperCase());
 return x;
}
function iso(x:unknown){
 if(typeof x!=="string"||!Number.isFinite(Date.parse(x))||
  !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)||
  new Date(x).toISOString()!==x)throw Error("CAPTURE_INVALID_TIME");
 return x;
}
const topKeys=["schema","kind","studyId","traceId","target","capturedAt",
 "observations","sourceVerified","testExecuted","executionAuthority"] as const;
export function validateBehaviorCapture(value:unknown):BehaviorCapture{
 if(!record(value))throw Error("CAPTURE_INVALID_OBJECT");
 keys(value,topKeys,"TOP");
 if(value.sourceVerified!==false||value.testExecuted!==false||
  value.executionAuthority!==false)throw Error("CAPTURE_AUTHORITY_REFUSED");
 if(value.schema!=="thinktank.behavior-capture.v1"||value.kind!=="operator-supplied")
  throw Error("CAPTURE_INVALID_SCHEMA");
 const studyId=bounded(value.studyId,"study_id",90);
 const traceId=bounded(value.traceId,"trace_id",90);
 if(!/^STUDY-[\w-]{8,80}$/.test(studyId)||!/^STEP-[\w-]{8,80}$/.test(traceId))
  throw Error("CAPTURE_INVALID_ID");
 const target=bounded(value.target,"target",120);
 const capturedAt=iso(value.capturedAt);
 if(!Array.isArray(value.observations)||value.observations.length<1||
  value.observations.length>CAPTURE_MAX_OBSERVATIONS)throw Error("CAPTURE_OBSERVATION_LIMIT");
 const observations:CaptureObservation[]=value.observations.map(x=>{
  if(!record(x))throw Error("CAPTURE_INVALID_OBSERVATION");
  keys(x,["key","value"],"OBSERVATION");
  const key=bounded(x.key,"key",80);
  if(!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(key))
   throw Error("CAPTURE_INVALID_KEY");
  return {key,value:bounded(x.value,"value",1000)};
 });
 if(new Set(observations.map(x=>x.key)).size!==observations.length)
  throw Error("CAPTURE_DUPLICATE_KEY");
 return {
  schema:"thinktank.behavior-capture.v1",kind:"operator-supplied",
  studyId,traceId,target,capturedAt,observations,
  sourceVerified:false,testExecuted:false,executionAuthority:false
 };
}
export function parseBehaviorCapture(raw:string,study:BehaviorStudy,traceId:string):BehaviorCapture{
 if(new TextEncoder().encode(raw).length>CAPTURE_MAX_BYTES)throw Error("CAPTURE_FILE_TOO_LARGE");
 let data:unknown;try{data=JSON.parse(raw)}catch{throw Error("CAPTURE_INVALID_JSON")}
 const capture=validateBehaviorCapture(data);
 const safe=validateBehaviorStudy(study);
 if(!safe.steps.some(x=>x.id===traceId))throw Error("CAPTURE_UNKNOWN_TRACE");
 if(capture.studyId!==safe.id||capture.traceId!==traceId||capture.target!==safe.target)
  throw Error("CAPTURE_CONTEXT_MISMATCH");
 return capture;
}
export function makeBehaviorCaptureTemplate(study:BehaviorStudy,trace:BehaviorStep,at:string){
 const safe=validateBehaviorStudy(study);
 if(!safe.steps.some(x=>x.id===trace.id))throw Error("CAPTURE_UNKNOWN_TRACE");
 const capture:BehaviorCapture={
  schema:"thinktank.behavior-capture.v1",kind:"operator-supplied",
  studyId:safe.id,traceId:trace.id,target:safe.target,capturedAt:iso(at),
  observations:[{key:"ui.visible-state",value:"REPLACE_WITH_A_LOCALLY_OBSERVED_VALUE"}],
  sourceVerified:false,testExecuted:false,executionAuthority:false
 };
 return JSON.stringify(capture,null,2);
}
export function compareBehaviorCaptures(base:BehaviorCapture,candidate:BehaviorCapture):BehaviorComparison{
 const a=validateBehaviorCapture(base),b=validateBehaviorCapture(candidate);
 if(a.studyId!==b.studyId||a.traceId!==b.traceId||a.target!==b.target)
  throw Error("CAPTURE_CONTEXT_MISMATCH");
 const am=new Map(a.observations.map(x=>[x.key,x.value]));
 const bm=new Map(b.observations.map(x=>[x.key,x.value]));
 const differences:BehaviorDifference[]=[...new Set([...am.keys(),...bm.keys()])]
  .sort((x,y)=>x<y?-1:x>y?1:0).map(key=>{
   const baseline=am.get(key)??null,candidate=bm.get(key)??null;
   const change=baseline===null?"ADDED":candidate===null?"MISSING":
    baseline===candidate?"UNCHANGED":"CHANGED";
   return {key,baseline,candidate,change};
  });
 return {schema:"thinktank.behavior-comparison.v1",status:"REVIEW_ONLY_NOT_A_TEST",
  studyId:a.studyId,traceId:a.traceId,target:a.target,
  differences,counts:{
   unchanged:differences.filter(x=>x.change==="UNCHANGED").length,
   changed:differences.filter(x=>x.change==="CHANGED").length,
   added:differences.filter(x=>x.change==="ADDED").length,
   missing:differences.filter(x=>x.change==="MISSING").length
  }
 };
}
export function buildBehaviorComparisonReport(
 comparison:BehaviorComparison,baselineSha256:string,candidateSha256:string
){
 if(!/^[a-f0-9]{64}$/.test(baselineSha256)||!/^[a-f0-9]{64}$/.test(candidateSha256))
  throw Error("CAPTURE_INVALID_DIGEST");
 if(comparison.status!=="REVIEW_ONLY_NOT_A_TEST")
  throw Error("CAPTURE_AUTHORITY_REFUSED");
 return JSON.stringify({
  ...comparison,
  provenance:"operator-supplied-file-bytes-only",
  integrityNote:"SHA-256 identifies selected file bytes. It does NOT validate observations, authorization, or app behavior.",
  baselineSha256,candidateSha256,
  evidenceVerified:false,testsPassed:false,executionAuthority:false
 },null,2);
}
