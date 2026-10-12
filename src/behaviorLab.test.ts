import {describe,expect,it} from "vitest";
import {
 appendBehaviorStep,buildBehaviorAcceptanceDraft,createBehaviorStudy,
 parseBehaviorStudies,serializeBehaviorStudies,BEHAVIOR_MAX_STEPS,
 BEHAVIOR_MAX_STUDIES,type TraceDraft
} from "./behaviorLab";
const time="2026-10-11T18:00:00.000Z";
const draft=()=>({target:"Our local charting prototype",
 scope:"Changing timeframes and chart layouts manually.",
 access:"owned" as const,accessNote:"Owned source and locally hosted application."});
const trace=():TraceDraft=>({
 kind:"operator-observed",before:"Timeframe is set to one hour.",
 action:"Change selector from one hour to one day.",
 after:"Chart updates to daily candle grouping.",
 interpretation:"Period selection appears to control aggregation.",
 originalDesign:"Independent state machine owns candle aggregation.",
 acceptanceCheck:"Fixture proves two periods produce distinct candles."
});
const study=()=>createBehaviorStudy(draft(),"STUDY-12345678",time);
const filled=()=>appendBehaviorStep(study(),trace(),"STEP-12345678",time);
describe("TT-38 original behavior lab",()=>{
 it("keeps observations unverified and generates only draft checks",()=>{
  const s=filled();const plan=buildBehaviorAcceptanceDraft(s);
  expect(s.authorizationVerified).toBe(false);
  expect(s.evidenceVerified).toBe(false);
  expect(s.executionAuthority).toBe(false);
  expect(s.automatedInspection).toBe(false);
  expect(s.steps[0].sourceVerified).toBe(false);
  expect(s.steps[0].testExecuted).toBe(false);
  expect(plan).toContain("NOT RUN");
  expect(plan).toContain("NOT EXECUTED");
  expect(plan).toContain("Independent state machine");
  expect(parseBehaviorStudies(serializeBehaviorStudies([s]))).toEqual([s]);
 });
 it("never treats permission assertions or hypotheses as verified",()=>{
  for(const access of ["public-interface","explicit-permission"] as const){
   const s=createBehaviorStudy({...draft(),access},"STUDY-12345678",time);
   const updated=appendBehaviorStep(s,{...trace(),kind:"hypothesis"},"STEP-12345678",time);
   expect(updated.authorizationVerified).toBe(false);
   expect(updated.steps[0].sourceVerified).toBe(false);
  }
 });
 it("rejects forged authority and injected study or trace fields",()=>{
  const bundle=JSON.parse(serializeBehaviorStudies([filled()]));
  bundle.studies[0].executionAuthority=true;
  expect(()=>parseBehaviorStudies(JSON.stringify(bundle))).toThrow(/AUTHORITY/);
  bundle.studies[0].executionAuthority=false;
  bundle.studies[0].authorizationVerified=true;
  expect(()=>parseBehaviorStudies(JSON.stringify(bundle))).toThrow(/AUTHORITY/);
  bundle.studies[0].authorizationVerified=false;
  bundle.studies[0].steps[0].testExecuted=true;
  expect(()=>parseBehaviorStudies(JSON.stringify(bundle))).toThrow(/AUTHORITY/);
  bundle.studies[0].steps[0].testExecuted=false;
  bundle.studies[0].steps[0].extra="fake";
  expect(()=>parseBehaviorStudies(JSON.stringify(bundle))).toThrow(/FIELDS/);
 });
 it("enforces bounded storage, strict status types and unique IDs",()=>{
  expect(()=>createBehaviorStudy({...draft(),access:"internal" as "owned"},"STUDY-12345678",time)).toThrow(/ACCESS/);
  expect(()=>appendBehaviorStep(study(),{...trace(),kind:"confirmed" as TraceDraft["kind"]},"STEP-12345678",time)).toThrow(/KIND/);
  expect(()=>appendBehaviorStep(filled(),trace(),"STEP-12345678",time)).toThrow(/DUPLICATE/);
  let s=study();
  for(let i=0;i<BEHAVIOR_MAX_STEPS;i++)
   s=appendBehaviorStep(s,trace(),"STEP-"+String(i).padStart(8,"0"),time);
  expect(()=>appendBehaviorStep(s,trace(),"STEP-87654321",time)).toThrow(/LIMIT/);
  expect(()=>serializeBehaviorStudies(Array(BEHAVIOR_MAX_STUDIES+1).fill(study()))).toThrow(/LIMIT/);
  expect(()=>serializeBehaviorStudies([study(),study()])).toThrow(/DUPLICATE/);
  expect(()=>parseBehaviorStudies("{bad")).toThrow(/JSON/);
  expect(parseBehaviorStudies(null)).toEqual([]);
 });
});
