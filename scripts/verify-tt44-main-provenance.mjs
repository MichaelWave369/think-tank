/* TT-44: trusted-main-only producer verification. No homegrown signature scheme.
 * GitHub CLI handles Sigstore verification and trusted workflow identity.
 */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {
 TT44_REPOSITORY,TT44_WORKFLOW,TT44_SOURCE_REF,
 TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH,
 ghAttestationVerifyArgs,parseVerifiedCLIResponse,
 readTT44Files,verifyLocalReceiptBinding
} from "./tt44-provenance-policy.mjs";

function requiredMainContext(){
 if(process.env.GITHUB_REPOSITORY!==TT44_REPOSITORY)
  throw Error("TT44_UNTRUSTED_REPOSITORY");
 if(process.env.GITHUB_REF!==TT44_SOURCE_REF)
  throw Error("TT44_MAIN_REF_REQUIRED");
 if(!["push","workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))
  throw Error("TT44_TRUSTED_MAIN_EVENT_REQUIRED");
 if(!process.env.GH_TOKEN)throw Error("TT44_GITHUB_TOKEN_REQUIRED");
 if(!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA??""))
  throw Error("TT44_INVALID_GITHUB_SHA");
 return process.env.GITHUB_SHA;
}
function verifyWithGitHub(file,sha){
 const args=ghAttestationVerifyArgs(file,sha);
 const raw=execFileSync("gh",args,{
  encoding:"utf8",timeout:120000,maxBuffer:4*1024*1024,
  env:{...process.env,GH_PROMPT_DISABLED:"1"}
 });
 return parseVerifiedCLIResponse(raw);
}
// Written explicitly rather than letting arbitrary shell interpolation in.
export async function runTT44Verification(){
 const commit=requiredMainContext();
 const {receipt,screenshot}=await readTT44Files();
 const local=verifyLocalReceiptBinding(receipt,screenshot,commit);
 const results=[
  {subject:TT44_RECEIPT_PATH,attestations:verifyWithGitHub(TT44_RECEIPT_PATH,commit)},
  {subject:TT44_SCREENSHOT_PATH,attestations:verifyWithGitHub(TT44_SCREENSHOT_PATH,commit)}
 ];
 assert.equal(results.length,2);
 const verification={
  schema:"thinktank.tt44-github-oidc-provenance-review.v1",
  status:"GITHUB_ATTESTATION_VERIFIED_FOR_EXACT_MAIN_ARTIFACT_BYTES",
  verifier:"gh attestation verify (GitHub CLI, trusted Sigstore roots)",
  repository:TT44_REPOSITORY,
  expectedSignerWorkflow:TT44_WORKFLOW,
  expectedSourceRef:TT44_SOURCE_REF,
  expectedCommit:commit,
  receiptSha256:local.receiptSha256,
  screenshotSha256:local.screenshotSha256,
  subjects:results,
  checkedAt:new Date().toISOString(),
  claimScope:"Exact built first-party counter fixture receipt and PNG only.",
  caveat:"This exported summary is editable, not itself a cryptographic attestation. Independently run gh attestation verify on original artifact bytes.",
  callerAuthenticated:false,
  canonicalEvidence:false,releaseAuthorized:false,antiMDone:false
 };
 await mkdir(dirname("artifacts/observatory/tt44-verification-summary.json"),{recursive:true});
 await writeFile("artifacts/observatory/tt44-verification-summary.json",
  JSON.stringify(verification,null,2)+"\n");
 console.log("TT44_GITHUB_OIDC_ATTESTATION_PASS",JSON.stringify({
  commit,verifiedSubjects:results.length,signerWorkflow:TT44_WORKFLOW,
  releaseAuthorized:false,antiMDone:false
 }));
 return verification;
}
await runTT44Verification();
