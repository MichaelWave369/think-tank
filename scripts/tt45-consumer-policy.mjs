/* TT-45: read-only consumer of an attested producer run, not a signer.
 * All authority is established by GitHub API run metadata + gh attestation
 * verify on original downloaded subject bytes, never by JSON claims alone.
 */
import {TT44_REPOSITORY,TT44_WORKFLOW,TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH,
 ghAttestationVerifyArgs,parseVerifiedCLIResponse,verifyLocalReceiptBinding
} from "./tt44-provenance-policy.mjs";

export const TT45_PRODUCER_NAME="thinktank-owned-receipt-oidc-provenance";
export const TT45_PRODUCER_PATH=".github/workflows/thinktank-owned-receipt-provenance.yml";
export const TT45_ARTIFACT_NAME="tt44-main-oidc-attested-owned-fixture";
export const TT45_MAX_RECEIPT_BYTES=131072;
export const TT45_MAX_SCREENSHOT_BYTES=3145728;
export const TT45_SUBJECTS=[TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH];

const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const required=(cond,code)=>{if(!cond)throw Error("TT45_"+code)};

export function parseProducerRunId(raw){
 const value=String(raw??"");
 required(/^[1-9][0-9]{0,15}$/.test(value),"INVALID_RUN_ID");
 const n=Number(value);
 required(Number.isSafeInteger(n)&&n>0,"INVALID_RUN_ID");
 return n;
}
export function validateProducerRun(input,requestedId){
 const id=parseProducerRunId(requestedId);
 required(object(input),"INVALID_RUN_METADATA");
 required(input.id===id,"RUN_ID_MISMATCH");
 required(input.name===TT45_PRODUCER_NAME,"WRONG_WORKFLOW_NAME");
 required(input.path===TT45_PRODUCER_PATH,"WRONG_WORKFLOW_PATH");
 required(input.repository?.full_name===TT44_REPOSITORY,"WRONG_REPOSITORY");
 required(input.head_repository?.full_name===TT44_REPOSITORY,"WRONG_HEAD_REPOSITORY");
 required(input.head_branch==="main","WRONG_BRANCH");
 required(["push","workflow_dispatch"].includes(input.event),"UNTRUSTED_EVENT");
 required(input.status==="completed"&&input.conclusion==="success","PRODUCER_NOT_GREEN");
 required(Number.isInteger(input.run_attempt)&&input.run_attempt>=1,"INVALID_ATTEMPT");
 required(typeof input.head_sha==="string"&&/^[a-f0-9]{40}$/.test(input.head_sha),"INVALID_COMMIT");
 return {
  producerRunId:id,
  repository:TT44_REPOSITORY,
  workflow:TT44_WORKFLOW,
  commit:input.head_sha,
  event:input.event,
  runAttempt:input.run_attempt
 };
}
export function validateConsumerArtifactFiles(receiptBytes,screenshotBytes,sourceCommit){
 required(Buffer.isBuffer(receiptBytes)||receiptBytes instanceof Uint8Array,"RECEIPT_BYTES_REQUIRED");
 required(Buffer.isBuffer(screenshotBytes)||screenshotBytes instanceof Uint8Array,"SCREENSHOT_BYTES_REQUIRED");
 required(receiptBytes.length>0&&receiptBytes.length<=TT45_MAX_RECEIPT_BYTES,"RECEIPT_SIZE_REFUSED");
 required(screenshotBytes.length>=8&&screenshotBytes.length<=TT45_MAX_SCREENSHOT_BYTES,"SCREENSHOT_SIZE_REFUSED");
 required(Buffer.from(screenshotBytes.subarray(0,8)).equals(
  Buffer.from([137,80,78,71,13,10,26,10])),"NOT_A_PNG");
 const text=new TextDecoder("utf-8",{fatal:true}).decode(receiptBytes);
 return verifyLocalReceiptBinding(text,screenshotBytes,sourceCommit);
}
export function consumerVerificationArgs(subject,downloadedPath,commit){
 // Verify a fixed known subject, but pass its *actual downloaded bytes* to gh.
 const args=ghAttestationVerifyArgs(subject,commit);
 required(typeof downloadedPath==="string"&&downloadedPath.length>0,"INVALID_LOCAL_PATH");
 args[2]=downloadedPath;
 return args;
}
export function requireGitHubVerifiedOutput(raw){
 return parseVerifiedCLIResponse(raw);
}
export function consumerSummary(run,content,verifiedSubjects){
 required(verifiedSubjects===2,"INCOMPLETE_SUBJECT_VERIFICATION");
 return {
  schema:"thinktank.tt45-independent-consumer-review.v1",
  status:"EXACT_SUBJECTS_VERIFIED_BY_INDEPENDENT_GH_CLI_RUN",
  producerRunId:run.producerRunId,
  producerRepository:run.repository,
  producerWorkflow:run.workflow,
  producerCommit:run.commit,
  producerEvent:run.event,
  receiptSha256:content.receiptSha256,
  screenshotSha256:content.screenshotSha256,
  subjectsVerified:2,
  verifier:"GitHub CLI gh attestation verify / Sigstore",
  authenticatedClaimScope:"Exact owned counter fixture artifact bytes from pinned GitHub producer workflow and source commit",
  reviewOnly:true,
  summarySigned:false,
  canonicalEvidence:false,
  releaseAuthorized:false,
  antiMDone:false,
  caveat:"This is an unsigned report of a completed CLI verification. The original subjects must be verified independently; this JSON is not proof on its own."
 };
}
