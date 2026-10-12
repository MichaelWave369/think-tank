import {describe,expect,it} from "vitest";
import {appendBehaviorStep,createBehaviorStudy} from "./behaviorLab";
import {makeBehaviorCaptureTemplate,validateBehaviorCapture} from "./behaviorCapture";
import {
 appendCaptureExpectation,createExpectationPlan,evaluateCaptureExpectations,
 exportCaptureEvaluation,validateExpectationPlan,EXPECTATION_MAX_RULES,
 type CaptureExpectation
} from "./captureExpectations";
const at="2026-10-11T22:30:00.000Z";
const study=()=>appendBehaviorStep(createBehaviorStudy({
 target:"My own prototype",scope:"Check UI state across a deterministic capture.",
 access:"owned",accessNote:"Local owned application in a read-only test setting."
},"STUDY-abcdefgh",at),{
 kind:"operator-observed",before:"App shows a baseline view.",
 action:"Switch modes with a visible control.",
 after:"App shows a different mode.",
 interpretation:"Mode choice seems to alter state.",
 originalDesign:"Our own independent state transition logic.",
 acceptanceCheck:"Compare a captured mode value."
},"STEP-abcdefgh",at);
const plan=()=>createExpectationPlan(study(),"STEP-abcdefgh");
const rule=(id="RULE-12345678",key="ui.mode",operator:CaptureExpectation["operator"]="equals",expected:string|null="night"):CaptureExpectation=>({
 id,key,operator,expected
});
const candidate=(observations:{key:string;value:string}[])=>{
 const s=study();const x=JSON.parse(makeBehaviorCaptureTemplate(s,s.steps[0],at));
 x.observations=observations;
 return validateBehaviorCapture(x);
};
describe("TT-40 capture-only expectations",()=>{
 it("compares string values deterministically without ever running target tests",()=>{
  let p=plan();
  p=appendCaptureExpectation(p,rule());
  p=appendCaptureExpectation(p,rule("RULE-87654321","ui.mode","differs","day"));
  p=appendCaptureExpectation(p,rule("RULE-22222222","ui.hidden","absent",null));
  p=appendCaptureExpectation(p,rule("RULE-33333333","ui.count","equals","42"));
  p=appendCaptureExpectation(p,rule("RULE-44444444","ui.active","present",null));
  const result=evaluateCaptureExpectations(p,candidate([
   {key:"ui.mode",value:"night"},{key:"ui.active",value:"true"}
  ]));
  expect(result.counts).toEqual({agrees:4,contradicts:0,notCaptured:1});
  expect(result.status).toBe("CAPTURE_ONLY_NOT_AN_APPLICATION_TEST");
  expect(result.evidenceVerified).toBe(false);
  expect(result.targetExecuted).toBe(false);
  expect(result.executionAuthority).toBe(false);
  const exported=JSON.parse(exportCaptureEvaluation(p,candidate([{key:"ui.mode",value:"night"},{key:"ui.active",value:"true"}]),"f".repeat(64)));
  expect(exported.testsPassed).toBe(false);
  expect(exported.evidenceVerified).toBe(false);
  expect(exported.warning).toContain("NOT an application");
 });
 it("flags disagreements, distinguishes absent key from an empty key, and never defaults to PASS",()=>{
  const p=appendCaptureExpectation(plan(),rule());
  const wrong=evaluateCaptureExpectations(p,candidate([{key:"ui.mode",value:"day"}]));
  expect(wrong.counts).toEqual({agrees:0,contradicts:1,notCaptured:0});
  const missing=evaluateCaptureExpectations(p,candidate([{key:"other",value:"day"}]));
  expect(missing.results[0].status).toBe("NOT_CAPTURED");
  expect(()=>evaluateCaptureExpectations(plan(),candidate([{key:"ui.mode",value:"day"}]))).toThrow(/NO_RULES/);
 });
 it("refuses forged verification, executable fields, bad comparators and wrong-context inputs",()=>{
  const good=appendCaptureExpectation(plan(),rule());
  expect(()=>validateExpectationPlan({...good,verified:true})).toThrow(/AUTHORITY/);
  expect(()=>validateExpectationPlan({...good,executionAuthority:true})).toThrow(/AUTHORITY/);
  expect(()=>validateExpectationPlan({...good,shell:"echo pwnd"})).toThrow(/FIELDS/);
  expect(()=>appendCaptureExpectation(plan(),{...rule(),operator:"eval" as CaptureExpectation["operator"]})).toThrow(/OPERATOR/);
  expect(()=>appendCaptureExpectation(plan(),rule("RULE-45678901","ui.status","present","yes"))).toThrow(/NULL/);
  expect(()=>appendCaptureExpectation(plan(),rule("RULE-45678901","__proto__","equals","a"))).toThrow(/KEY/);
  expect(()=>evaluateCaptureExpectations({...good,traceId:"STEP-87654321"},candidate([{key:"ui.mode",value:"night"}]))).toThrow(/MISMATCH/);
  const forged=JSON.parse(JSON.stringify(good)); forged.executionAuthority=true;
  expect(()=>exportCaptureEvaluation(forged,candidate([{key:"ui.mode",value:"night"}]),"f".repeat(64))).toThrow(/AUTHORITY/);
  expect(()=>exportCaptureEvaluation(good,candidate([{key:"ui.mode",value:"night"}]),"not-a-hash")).toThrow(/DIGEST/);
 });
 it("limits rule count and unique rule IDs",()=>{
  let p=plan();
  expect(()=>appendCaptureExpectation(appendCaptureExpectation(p,rule()),rule())).toThrow(/DUPLICATE/);
  for(let i=0;i<EXPECTATION_MAX_RULES;i++){
   p=appendCaptureExpectation(p,rule("RULE-"+String(i).padStart(8,"0"),"ui.mode","equals","night"));
  }
  expect(()=>appendCaptureExpectation(p,rule("RULE-overflow","ui.mode","equals","night"))).toThrow(/LIMIT/);
 });
});
