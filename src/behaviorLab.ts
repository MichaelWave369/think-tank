/* TT-38: manual, review-only studies. No application inspection or execution. */
export const BEHAVIOR_STORAGE_KEY="thinktank-behavior-lab-v1";
export const BEHAVIOR_MAX_STUDIES=24;
export const BEHAVIOR_MAX_STEPS=32;
export type AccessBasis="owned"|"explicit-permission"|"public-interface";
export type TraceKind="operator-observed"|"public-documentation"|"hypothesis";
export type StudyDraft={target:string;scope:string;access:AccessBasis;accessNote:string};
export type TraceDraft={
 kind:TraceKind;before:string;action:string;after:string;
 interpretation:string;originalDesign:string;acceptanceCheck:string;
};
export type BehaviorStep=TraceDraft&{
 schema:"thinktank.behavior-step.v1";id:string;capturedAt:string;
 sourceVerified:false;testExecuted:false;
};
export type BehaviorStudy=StudyDraft&{
 schema:"thinktank.behavior-study.v1";id:string;createdAt:string;steps:BehaviorStep[];
 provenance:"operator-unverified";authorizationVerified:false;
 evidenceVerified:false;executionAuthority:false;automatedInspection:false;
};
const stepKeys=["schema","id","capturedAt","kind","before","action","after",
 "interpretation","originalDesign","acceptanceCheck","sourceVerified","testExecuted"];
const studyKeys=["schema","id","createdAt","steps","target","scope","access",
 "accessNote","provenance","authorizationVerified","evidenceVerified","executionAuthority","automatedInspection"];
function record(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==="object"&&!Array.isArray(x);
}
function shape(x:Record<string,unknown>,keys:string[],kind:string):void{
 if(Object.keys(x).sort().join("|")!==[...keys].sort().join("|"))
  throw Error("BEHAVIOR_INVALID_"+kind+"_FIELDS");
}
function note(x:unknown,name:string,max:number):string{
 if(typeof x!=="string"||x.trim().length<3||x.length>max||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))
  throw Error("BEHAVIOR_INVALID_"+name.toUpperCase());
 return x.trim();
}
function id(x:unknown,prefix:string):string{
 if(typeof x!=="string"||!new RegExp("^"+prefix+"-[\\w-]{8,80}$").test(x))
  throw Error("BEHAVIOR_INVALID_ID");
 return x;
}
function time(x:unknown):string{
 if(typeof x!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)||
  !Number.isFinite(Date.parse(x))||new Date(x).toISOString()!==x)
  throw Error("BEHAVIOR_INVALID_TIME");
 return x;
}
export function createBehaviorStudy(d:StudyDraft,studyId:string,createdAt:string):BehaviorStudy{
 if(!["owned","explicit-permission","public-interface"].includes(d.access))
  throw Error("BEHAVIOR_INVALID_ACCESS");
 return {schema:"thinktank.behavior-study.v1",id:id(studyId,"STUDY"),
  createdAt:time(createdAt),target:note(d.target,"target",120),
  scope:note(d.scope,"scope",550),access:d.access,
  accessNote:note(d.accessNote,"access_note",550),steps:[],
  provenance:"operator-unverified",authorizationVerified:false,
  evidenceVerified:false,executionAuthority:false,automatedInspection:false};
}
export function createBehaviorStep(d:TraceDraft,stepId:string,capturedAt:string):BehaviorStep{
 if(!["operator-observed","public-documentation","hypothesis"].includes(d.kind))
  throw Error("BEHAVIOR_INVALID_KIND");
 return {schema:"thinktank.behavior-step.v1",id:id(stepId,"STEP"),
  capturedAt:time(capturedAt),kind:d.kind,
  before:note(d.before,"before",1200),action:note(d.action,"action",1200),
  after:note(d.after,"after",1200),
  interpretation:note(d.interpretation,"interpretation",1200),
  originalDesign:note(d.originalDesign,"original_design",1200),
  acceptanceCheck:note(d.acceptanceCheck,"acceptance_check",1200),
  sourceVerified:false,testExecuted:false};
}
function validatedStep(x:unknown):BehaviorStep{
 if(!record(x))throw Error("BEHAVIOR_INVALID_STEP");
 shape(x,stepKeys,"STEP");
 if(x.sourceVerified!==false||x.testExecuted!==false)throw Error("BEHAVIOR_AUTHORITY_REFUSED");
 const step=createBehaviorStep(x as unknown as TraceDraft,x.id as string,x.capturedAt as string);
 for(const k of stepKeys)if(step[k as keyof BehaviorStep]!==x[k])
  throw Error("BEHAVIOR_INVALID_STEP_VALUE");
 return step;
}
export function validateBehaviorStudy(x:unknown):BehaviorStudy{
 if(!record(x))throw Error("BEHAVIOR_INVALID_STUDY");
 shape(x,studyKeys,"STUDY");
 if(x.provenance!=="operator-unverified"||x.authorizationVerified!==false||
  x.evidenceVerified!==false||x.executionAuthority!==false||
  x.automatedInspection!==false)throw Error("BEHAVIOR_AUTHORITY_REFUSED");
 if(!Array.isArray(x.steps)||x.steps.length>BEHAVIOR_MAX_STEPS)
  throw Error("BEHAVIOR_STEP_LIMIT");
 const study=createBehaviorStudy(x as unknown as StudyDraft,x.id as string,x.createdAt as string);
 for(const k of ["target","scope","access","accessNote"] as const)
  if(study[k]!==x[k])throw Error("BEHAVIOR_INVALID_STUDY_VALUE");
 const steps=x.steps.map(validatedStep);
 if(new Set(steps.map(s=>s.id)).size!==steps.length)throw Error("BEHAVIOR_DUPLICATE_STEP");
 return {...study,steps};
}
export function appendBehaviorStep(study:BehaviorStudy,d:TraceDraft,stepId:string,createdAt:string):BehaviorStudy{
 const checked=validateBehaviorStudy(study);
 if(checked.steps.length>=BEHAVIOR_MAX_STEPS)throw Error("BEHAVIOR_STEP_LIMIT");
 const step=createBehaviorStep(d,stepId,createdAt);
 if(checked.steps.some(s=>s.id===step.id))throw Error("BEHAVIOR_DUPLICATE_STEP");
 return {...checked,steps:[...checked.steps,step]};
}
export function serializeBehaviorStudies(studies:BehaviorStudy[]):string{
 if(studies.length>BEHAVIOR_MAX_STUDIES)throw Error("BEHAVIOR_STUDY_LIMIT");
 const checked=studies.map(validateBehaviorStudy);
 if(new Set(checked.map(s=>s.id)).size!==checked.length)throw Error("BEHAVIOR_DUPLICATE_STUDY");
 const raw=JSON.stringify({schema:"thinktank.behavior-bundle.v1",kind:"operator-review-only",studies:checked},null,2);
 if(new TextEncoder().encode(raw).length>512000)throw Error("BEHAVIOR_STORAGE_LIMIT");
 return raw;
}
export function parseBehaviorStudies(raw:string|null):BehaviorStudy[]{
 if(raw===null)return [];
 if(raw.length>512000)throw Error("BEHAVIOR_STORAGE_LIMIT");
 let x:unknown;try{x=JSON.parse(raw)}catch{throw Error("BEHAVIOR_INVALID_JSON")}
 if(!record(x))throw Error("BEHAVIOR_INVALID_BUNDLE");
 shape(x,["schema","kind","studies"],"BUNDLE");
 if(x.schema!=="thinktank.behavior-bundle.v1"||x.kind!=="operator-review-only"||
  !Array.isArray(x.studies)||x.studies.length>BEHAVIOR_MAX_STUDIES)
  throw Error("BEHAVIOR_INVALID_BUNDLE");
 const studies=x.studies.map(validateBehaviorStudy);
 if(new Set(studies.map(s=>s.id)).size!==studies.length)throw Error("BEHAVIOR_DUPLICATE_STUDY");
 return studies;
}
export function buildBehaviorAcceptanceDraft(study:BehaviorStudy):string{
 const safe=validateBehaviorStudy(study);
 const out=["# Software Behavior Lab | Acceptance draft","",
  "OPERATOR NOTES ONLY. NO VERIFIED SOURCE, AUTHORIZATION, TEST EXECUTION OR PASS STATUS.","",
  "Target: "+safe.target,"Scope: "+safe.scope,
  "Operator-reported access (NOT verified): "+safe.access,
  "Access note: "+safe.accessNote,"Study ID: "+safe.id,""];
 for(const [i,s] of safe.steps.entries())out.push(
  "## Candidate "+(i+1)+" | "+s.kind,
  "- Before: "+s.before,"- Action: "+s.action,
  "- Reported after: "+s.after,"- Interpretation: "+s.interpretation,
  "- Original design: "+s.originalDesign,
  "- Proposed check (NOT RUN): "+s.acceptanceCheck,
  "- Status: UNVERIFIED / NOT EXECUTED","");
 if(!safe.steps.length)out.push("No traces recorded.","");
 return out.join("\n");
}
