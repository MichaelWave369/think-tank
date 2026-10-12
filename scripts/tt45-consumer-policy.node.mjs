import {test} from "node:test";
import assert from "node:assert/strict";
import {
 TT45_PRODUCER_NAME,TT45_PRODUCER_PATH,TT45_ARTIFACT_NAME,
 parseProducerRunId,validateProducerRun,validateConsumerArtifactFiles,
 consumerVerificationArgs,requireGitHubVerifiedOutput,consumerSummary
} from "./tt45-consumer-policy.mjs";
import {
 TT44_REPOSITORY,TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH
} from "./tt44-provenance-policy.mjs";
import {createHash} from "node:crypto";

const sha="b".repeat(40),digest=b=>createHash("sha256").update(b).digest("hex");
const screenshot=Buffer.from([137,80,78,71,13,10,26,10,3,4,5,6]);
const producer=()=>({
 id:38195702863,name:TT45_PRODUCER_NAME,path:TT45_PRODUCER_PATH,
 repository:{full_name:TT44_REPOSITORY},
 head_repository:{full_name:TT44_REPOSITORY},
 head_branch:"main",head_sha:sha,status:"completed",conclusion:"success",
 event:"push",run_attempt:1
});
const receipt=()=>({
 schema:"thinktank.owned-app-browser-observation.v1",
 status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
 scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
 target:"ThinkTank owned counter fixture",
 actualAppExercised:"independent-owned-html-counter-fixture",
 measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
 checkedOutCommit:sha,
 screenshot:{name:"tt42-owned-target.png",sha256:digest(screenshot)},
 rounds:[1,2].map(round=>({
  round,before:{"ui.mode":"day","ui.count":"0"},
  after:{"ui.mode":"night","ui.count":"1"}
 })),
 assertions:{externalRequests:0,mutationRequests:0,pageExceptions:0,
  beforeMatchesContract:true,afterMatchesContract:true,deterministicReload:true},
 signed:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false,
 thirdPartyAppTested:false,testExecutedOnOwnedFixture:true
});

test("TT45 accepts only completed trusted main producer runs",()=>{
 assert.equal(parseProducerRunId("38195702863"),38195702863);
 assert.equal(validateProducerRun(producer(),38195702863).commit,sha);
 for(const [field,value] of [
  ["name","lookalike"],["path",".github/workflows/another.yml"],
  ["head_branch","feature"],["head_sha","invalid"],["event","pull_request"],
  ["status","in_progress"],["conclusion","failure"]
 ]){
  const candidate={...producer(),[field]:value};
  assert.throws(()=>validateProducerRun(candidate,candidate.id),/TT45_/);
 }
 const wrongRepo={...producer(),repository:{full_name:"someone-else/think-tank"}};
 assert.throws(()=>validateProducerRun(wrongRepo,producer().id),/WRONG_REPOSITORY/);
 const fork={...producer(),head_repository:{full_name:"someone-else/think-tank"}};
 assert.throws(()=>validateProducerRun(fork,producer().id),/HEAD_REPOSITORY/);
 assert.throws(()=>validateProducerRun(producer(),38195702864),/RUN_ID_MISMATCH/);
 for(const invalid of ["abc","https://github.com/repo","0","-1","1;rm -rf /"]){
  assert.throws(()=>parseProducerRunId(invalid),/RUN_ID/);
 }
});

test("TT45 independently binds original fixture bytes to producer commit",()=>{
 const raw=Buffer.from(JSON.stringify(receipt()));
 const content=validateConsumerArtifactFiles(raw,screenshot,sha);
 assert.equal(content.receiptSha256,digest(raw));
 assert.equal(content.screenshotSha256,digest(screenshot));
 assert.throws(()=>validateConsumerArtifactFiles(raw,screenshot,"a".repeat(40)),/COMMIT_MISMATCH/);
 assert.throws(()=>validateConsumerArtifactFiles(raw,Buffer.from("not-a-png"),sha),/NOT_A_PNG/);
 assert.throws(()=>validateConsumerArtifactFiles(raw,Buffer.alloc(3145729),sha),/SCREENSHOT_SIZE_REFUSED/);
 assert.throws(()=>validateConsumerArtifactFiles(Buffer.alloc(131073),screenshot,sha),/RECEIPT_SIZE_REFUSED/);
 const forged=receipt();forged.antiMDone=true;
 assert.throws(()=>validateConsumerArtifactFiles(Buffer.from(JSON.stringify(forged)),screenshot,sha),/RECEIPT_antiMDone/);
 const badImage=Buffer.from(screenshot);badImage[badImage.length-1]=99;
 assert.throws(()=>validateConsumerArtifactFiles(raw,badImage,sha),/IMAGE_DIGEST_MISMATCH/);
});

test("TT45 CLI signature verification is tied to fixed workflow identity",()=>{
 const file="/temporary/safely-downloaded/receipt.json";
 const args=consumerVerificationArgs(TT44_RECEIPT_PATH,file,sha);
 assert.deepEqual(args,[
  "attestation","verify",file,
  "--repo",TT44_REPOSITORY,
  "--signer-workflow",TT44_REPOSITORY+"/.github/workflows/thinktank-owned-receipt-provenance.yml",
  "--source-ref","refs/heads/main","--source-digest",sha,
  "--deny-self-hosted-runners","--format","json"
 ]);
 assert.equal(consumerVerificationArgs(TT44_SCREENSHOT_PATH,"/tmp/image.png",sha)[2],"/tmp/image.png");
 assert.throws(()=>consumerVerificationArgs("other-path","/tmp/evil",sha),/PATH_NOT_ALLOWED/);
 assert.throws(()=>consumerVerificationArgs(TT44_RECEIPT_PATH,"",sha),/INVALID_LOCAL_PATH/);
 assert.throws(()=>requireGitHubVerifiedOutput("[]"),/NO_VERIFIED_ATTESTATIONS/);
 assert.throws(()=>requireGitHubVerifiedOutput("bad"),/INVALID_JSON/);
 // This shape test never substitutes for real GitHub CLI signature verification.
 assert.equal(requireGitHubVerifiedOutput(JSON.stringify([
  {attestation:{},verificationResult:{}}
 ])),1);
});
test("TT45 review does not grant canonical release or Anti-M DONE",()=>{
 const run=validateProducerRun(producer(),38195702863);
 const bytes=validateConsumerArtifactFiles(Buffer.from(JSON.stringify(receipt())),screenshot,sha);
 const report=consumerSummary(run,bytes,2);
 assert.equal(report.status,"EXACT_SUBJECTS_VERIFIED_BY_INDEPENDENT_GH_CLI_RUN");
 assert.equal(report.summarySigned,false);
 assert.equal(report.canonicalEvidence,false);
 assert.equal(report.releaseAuthorized,false);
 assert.equal(report.antiMDone,false);
 assert.equal(report.producerRunId,38195702863);
 assert.equal(TT45_ARTIFACT_NAME,"tt44-main-oidc-attested-owned-fixture");
 assert.throws(()=>consumerSummary(run,bytes,1),/INCOMPLETE_SUBJECT_VERIFICATION/);
});
