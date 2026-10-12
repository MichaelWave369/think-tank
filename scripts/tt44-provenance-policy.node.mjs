import {test} from "node:test";
import assert from "node:assert/strict";
import {
 TT44_REPOSITORY,TT44_WORKFLOW,TT44_SOURCE_REF,
 TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH,
 ghAttestationVerifyArgs,parseVerifiedCLIResponse,
 verifyLocalReceiptBinding,hexSha256
} from "./tt44-provenance-policy.mjs";

const sha="a".repeat(40);
const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
const fake=()=>({
 schema:"thinktank.owned-app-browser-observation.v1",
 status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
 scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
 target:"ThinkTank owned counter fixture",
 actualAppExercised:"independent-owned-html-counter-fixture",
 measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
 checkedOutCommit:sha,
 screenshot:{name:"tt42-owned-target.png",sha256:hexSha256(png)},
 rounds:[1,2].map(round=>({
  round,before:{"ui.mode":"day","ui.count":"0"},
  after:{"ui.mode":"night","ui.count":"1"}
 })),
 assertions:{
  externalRequests:0,mutationRequests:0,pageExceptions:0,
  beforeMatchesContract:true,afterMatchesContract:true,deterministicReload:true
 },
 signed:false,canonicalEvidence:false,releaseAuthorized:false,
 antiMDone:false,thirdPartyAppTested:false,testExecutedOnOwnedFixture:true
});
test("TT-44 hardcodes repository, signer workflow, ref and commit in GH CLI policy",()=>{
 for(const target of [TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH]){
  const args=ghAttestationVerifyArgs(target,sha);
  assert.deepEqual(args,[
   "attestation","verify",target,
   "--repo",TT44_REPOSITORY,
   "--signer-workflow",TT44_WORKFLOW,
   "--source-ref",TT44_SOURCE_REF,
   "--source-digest",sha,
   "--deny-self-hosted-runners",
   "--format","json"
  ]);
 }
 assert.throws(()=>ghAttestationVerifyArgs("https://example.com/target",sha),/PATH_NOT_ALLOWED/);
 assert.throws(()=>ghAttestationVerifyArgs("../../receipt.json",sha),/PATH_NOT_ALLOWED/);
 assert.throws(()=>ghAttestationVerifyArgs(TT44_RECEIPT_PATH,"wrong"),/INVALID_COMMIT/);
});
test("TT-44 local pre-verification check binds exact image bytes and expected Git SHA",()=>{
 const raw=JSON.stringify(fake());
 const valid=verifyLocalReceiptBinding(raw,png,sha);
 assert.equal(valid.status,"LOCAL_CONTENT_CONSISTENT_NOT_AUTHENTICATED");
 assert.equal(valid.screenshotSha256,hexSha256(png));
 assert.equal(valid.receiptSha256,hexSha256(Buffer.from(raw)));
 assert.throws(()=>verifyLocalReceiptBinding(raw,png,"b".repeat(40)),/COMMIT_MISMATCH/);
 assert.throws(()=>verifyLocalReceiptBinding(raw,Buffer.from("different"),sha),/IMAGE_DIGEST_MISMATCH/);
 for(const [field,value] of [
  ["releaseAuthorized",true],["antiMDone",true],
  ["canonicalEvidence",true],["signed",true],
  ["scope","EXTERNAL_APP"],["thirdPartyAppTested",true]
 ]){
  const obj={...fake(),[field]:value};
  assert.throws(()=>verifyLocalReceiptBinding(JSON.stringify(obj),png,sha),/RECEIPT_/);
 }
});
test("TT-44 preserves distinction between CLI result JSON and real cryptographic verification",()=>{
 assert.throws(()=>parseVerifiedCLIResponse("[]"),/NO_VERIFIED_ATTESTATIONS/);
 assert.throws(()=>parseVerifiedCLIResponse("{}"),/NO_VERIFIED_ATTESTATIONS/);
 assert.throws(()=>parseVerifiedCLIResponse("{invalid"),/INVALID_JSON/);
 assert.throws(()=>parseVerifiedCLIResponse(JSON.stringify([{
  attestation:{},verificationResult:null
 }])),/MISSING_VERIFICATION_RESULT/);
 // Only an external gh verify exit status, not this local JSON shape, conveys authenticity.
 const mock=[{attestation:{bundle:"fixture"},verificationResult:{signature:"fixture"}}];
 assert.equal(parseVerifiedCLIResponse(JSON.stringify(mock)),1);
});
