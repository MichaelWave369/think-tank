import {describe,it,expect} from "vitest";
import {
 OWNED_IMAGE_MAX_BYTES,OWNED_RECEIPT_MAX_BYTES,buildOwnedReceiptReview,
 parseOwnedProbeReceipt,validateOwnedProbeReceipt
} from "./ownedReceiptReview";
const d=(ch:string)=>ch.repeat(64);
const sample=()=>({
 schema:"thinktank.owned-app-browser-observation.v1",
 status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
 scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
 target:"ThinkTank owned counter fixture",
 actualAppExercised:"independent-owned-html-counter-fixture",
 browserEngine:"chromium",browserVersion:"142.0.7500.3",
 checkedOutCommit:"c".repeat(40),runAt:"2026-10-12T01:39:33.468Z",
 fixtureSourceSha256:d("a"),checkedInContractSha256:d("b"),
 measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
 rounds:[1,2].map(round=>({round,before:{"ui.mode":"day","ui.count":"0"},
  after:{"ui.mode":"night","ui.count":"1"}})),
 assertions:{beforeMatchesContract:true,afterMatchesContract:true,deterministicReload:true,
  externalRequests:0,mutationRequests:0,pageExceptions:0},
 screenshot:{name:"tt42-owned-target.png",sha256:d("d")},
 sourceValues:"MEASURED_FROM_OUR_RUNNING_FIXTURE_NOT_OPERATOR_ENTERED_JSON",
 separateFromTT39OperatorCaptureSchema:true,testExecutedOnOwnedFixture:true,
 thirdPartyAppTested:false,signed:false,canonicalEvidence:false,
 releaseAuthorized:false,antiMDone:false
});
describe("TT-43 imported machine receipt review",()=>{
 it("accepts exact TT-42 schema, compares both measured rounds, and never upgrades proof",()=>{
  const receipt=parseOwnedProbeReceipt(JSON.stringify(sample()));
  expect(receipt.rounds[0].before).toEqual(receipt.rounds[1].before);
  expect(receipt.rounds[0].after).toEqual(receipt.rounds[1].after);
  const review=buildOwnedReceiptReview(receipt,d("e"),true);
  expect(review.status).toBe("STRUCTURALLY_CONSISTENT_UNAUTHENTICATED");
  expect(review.screenshotDigestComparison).toBe("MATCHES_DECLARED_BYTES");
  expect(review.originAuthenticated).toBe(false);
  expect(review.testExecutionAuthenticated).toBe(false);
  expect(review.evidenceVerified).toBe(false);
  expect(review.antiMDone).toBe(false);
  expect(buildOwnedReceiptReview(receipt,d("e"),null).screenshotDigestComparison).toBe("NOT_PROVIDED");
 });
 it("refuses injected provenance and forged release authority",()=>{
  for(const [field,value] of [
   ["signed",true],["releaseAuthorized",true],["antiMDone",true],
   ["canonicalEvidence",true],["thirdPartyAppTested",true],
   ["testExecutedOnOwnedFixture",false],["status","VERIFIED"],
   ["actualAppExercised","external-app"]
  ]){
   const x={...sample(),[field]:value};
   expect(()=>validateOwnedProbeReceipt(x)).toThrow(/RECEIPT_INVALID_FIXED/);
  }
  const x={...sample(),network:"https://external.invalid"};
  expect(()=>validateOwnedProbeReceipt(x)).toThrow(/ROOT_FIELDS/);
 });
 it("rejects tampered rounds, skipped actions, wrong counts, and false network assertions",()=>{
  const x=sample();
  x.rounds[0].after["ui.count"]="99";
  expect(()=>validateOwnedProbeReceipt(x)).toThrow(/AFTER_COUNT/);
  const y=sample();y.rounds[1].round=3;
  expect(()=>validateOwnedProbeReceipt(y)).toThrow(/ROUND_NUMBER/);
  const z=sample();z.assertions.externalRequests=1;
  expect(()=>validateOwnedProbeReceipt(z)).toThrow(/ASSERTION_externalRequests/);
  const w=sample();w.rounds[0].before["ui.mode"]="evil";
  expect(()=>validateOwnedProbeReceipt(w)).toThrow(/BEFORE_MODE/);
 });
 it("enforces digest constraints, sizes, and strict JSON",()=>{
  expect(()=>parseOwnedProbeReceipt("{bad")).toThrow(/JSON/);
  expect(()=>parseOwnedProbeReceipt("x".repeat(OWNED_RECEIPT_MAX_BYTES+1))).toThrow(/LARGE/);
  expect(OWNED_IMAGE_MAX_BYTES).toBe(3145728);
  const x=sample();x.screenshot.sha256="not a hash";
  expect(()=>validateOwnedProbeReceipt(x)).toThrow(/SCREENSHOT_DIGEST/);
  const checked=validateOwnedProbeReceipt(sample());
  expect(()=>buildOwnedReceiptReview(checked,"not a sha",null)).toThrow(/RECEIPT_DIGEST/);
  expect(()=>buildOwnedReceiptReview(checked,d("e"),false)).toThrow(/SCREENSHOT_MISMATCH/);
 });
});
