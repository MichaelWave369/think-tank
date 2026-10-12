import {describe,it,expect} from "vitest";
import {appendBehaviorStep,createBehaviorStudy,type TraceDraft} from "./behaviorLab";
import {
 CAPTURE_MAX_BYTES,buildBehaviorComparisonReport,compareBehaviorCaptures,
 makeBehaviorCaptureTemplate,parseBehaviorCapture,validateBehaviorCapture
} from "./behaviorCapture";

const now="2026-10-11T20:00:00.000Z";
const draft:TraceDraft={
 kind:"operator-observed",before:"Initial display is loaded.",
 action:"Change the displayed view to another mode.",
 after:"A new display state is visible.",
 interpretation:"State controls may update the viewport.",
 originalDesign:"Build our own deterministic state reducer.",
 acceptanceCheck:"Assert output using an isolated test fixture."
};
const study=()=>appendBehaviorStep(
 createBehaviorStudy({target:"Our own demo",scope:"Local UI state comparison",
  access:"owned",accessNote:"Software code and locally generated captures belong to us."},
 "STUDY-abcdefgh",now),
 draft,"STEP-abcdefgh",now
);
function capture(items:{key:string;value:string}[]){
 const s=study(),c=JSON.parse(makeBehaviorCaptureTemplate(s,s.steps[0],now));
 c.observations=items;
 return c;
}
describe("TT-39 local, review-only behavior comparison",()=>{
 it("parses an operator-selected template and reports changed, added, missing and unchanged fields",()=>{
  const s=study();
  const baseline=parseBehaviorCapture(JSON.stringify(capture([
   {key:"ui.mode",value:"day"},{key:"ui.count",value:"7"},
   {key:"ui.old",value:"present"}])),s,s.steps[0].id);
  const candidate=parseBehaviorCapture(JSON.stringify(capture([
   {key:"ui.mode",value:"night"},{key:"ui.count",value:"7"},
   {key:"ui.new",value:"present"}])),s,s.steps[0].id);
  const comparison=compareBehaviorCaptures(baseline,candidate);
  expect(comparison.counts).toEqual({unchanged:1,changed:1,added:1,missing:1});
  expect(comparison.status).toBe("REVIEW_ONLY_NOT_A_TEST");
  expect(comparison.differences.map(d=>d.key)).toEqual(["ui.count","ui.mode","ui.new","ui.old"]);
  expect(comparison.differences.find(d=>d.key==="ui.mode")?.change).toBe("CHANGED");
  const report=JSON.parse(buildBehaviorComparisonReport(comparison,"a".repeat(64),"b".repeat(64)));
  expect(report.testsPassed).toBe(false);
  expect(report.evidenceVerified).toBe(false);
  expect(report.executionAuthority).toBe(false);
  expect(report.integrityNote).toMatch(/does NOT validate/);
 });
 it("rejects fabricated verification flags, unknown properties and invalid keys",()=>{
  for(const field of ["sourceVerified","testExecuted","executionAuthority"]){
   const forged=capture([{key:"ui.state",value:"ok"}]);
   forged[field]=true;
   expect(()=>validateBehaviorCapture(forged)).toThrow(/AUTHORITY/);
  }
  const extra=capture([{key:"ui.state",value:"ok"}]);
  extra.shellCommand="rm -rf .";
  expect(()=>validateBehaviorCapture(extra)).toThrow(/FIELDS/);
  const row=capture([{key:"ui.state",value:"ok"}]);
  row.observations[0].executable=true;
  expect(()=>validateBehaviorCapture(row)).toThrow(/FIELDS/);
  expect(()=>validateBehaviorCapture(capture([{key:"__proto__",value:"ok"}]))).toThrow(/KEY/);
  expect(()=>validateBehaviorCapture(capture([
   {key:"dup.key",value:"foo"},{key:"dup.key",value:"bar"}
  ]))).toThrow(/DUPLICATE/);
 });
 it("rejects context mismatches, malformed payloads and overlarge files",()=>{
  const s=study(),base=capture([{key:"ui.state",value:"ok"}]);
  expect(()=>parseBehaviorCapture(JSON.stringify({...base,studyId:"STUDY-otherxyz"}),s,s.steps[0].id)).toThrow(/MISMATCH/);
  expect(()=>parseBehaviorCapture(JSON.stringify({...base,target:"Another app"}),s,s.steps[0].id)).toThrow(/MISMATCH/);
  expect(()=>parseBehaviorCapture(JSON.stringify(base),s,"STEP-00000000")).toThrow(/UNKNOWN_TRACE/);
  expect(()=>parseBehaviorCapture("{bad",s,s.steps[0].id)).toThrow(/JSON/);
  expect(()=>parseBehaviorCapture("x".repeat(CAPTURE_MAX_BYTES+1),s,s.steps[0].id)).toThrow(/LARGE/);
  expect(()=>compareBehaviorCaptures(
   validateBehaviorCapture(base),
   validateBehaviorCapture({...base,traceId:"STEP-otherxyz"})
  )).toThrow(/MISMATCH/);
  const compare=compareBehaviorCaptures(validateBehaviorCapture(base),validateBehaviorCapture(base));
  expect(()=>buildBehaviorComparisonReport(compare,"unhashed","b".repeat(64))).toThrow(/DIGEST/);
 });
});
