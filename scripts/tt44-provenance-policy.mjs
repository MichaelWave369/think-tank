/* TT-44: narrow, fail-closed policy for OIDC-linked GitHub artifact attestations.
 * It does not verify signatures itself: only "gh attestation verify" may do that.
 * Policy checks are original and have no dynamic paths or trust overrides.
 */
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

export const TT44_REPOSITORY="MichaelWave369/think-tank";
export const TT44_WORKFLOW="MichaelWave369/think-tank/.github/workflows/thinktank-owned-receipt-provenance.yml";
export const TT44_SOURCE_REF="refs/heads/main";
export const TT44_RECEIPT_PATH="artifacts/observatory/tt42-owned-target-receipt.json";
export const TT44_SCREENSHOT_PATH="artifacts/observatory/tt42-owned-target.png";

export const hexSha256=bytes=>createHash("sha256").update(bytes).digest("hex");
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const equals=(x,y,reason)=>{if(x!==y)throw Error("TT44_POLICY_"+reason)};
const digest=x=>{
 if(typeof x!=="string"||!/^[a-f0-9]{64}$/.test(x))
  throw Error("TT44_POLICY_INVALID_DIGEST");
 return x;
};
const commit=x=>{
 if(typeof x!=="string"||!/^[a-f0-9]{40}$/.test(x))
  throw Error("TT44_POLICY_INVALID_COMMIT");
 return x;
};

export function verifyLocalReceiptBinding(rawReceipt,imageBytes,expectedSha){
 const sha=commit(expectedSha);
 if(!(imageBytes instanceof Uint8Array))throw Error("TT44_POLICY_IMAGE_BYTES_REQUIRED");
 let data;
 try{data=JSON.parse(rawReceipt)}catch{throw Error("TT44_POLICY_INVALID_RECEIPT_JSON")}
 if(!isRecord(data))throw Error("TT44_POLICY_INVALID_RECEIPT_OBJECT");
 const required={
  schema:"thinktank.owned-app-browser-observation.v1",
  status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
  scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
  target:"ThinkTank owned counter fixture",
  actualAppExercised:"independent-owned-html-counter-fixture",
  measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
  signed:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false,
  thirdPartyAppTested:false,testExecutedOnOwnedFixture:true
 };
 for(const [key,value] of Object.entries(required))
  equals(data[key],value,"RECEIPT_"+key);
 equals(data.checkedOutCommit,sha,"COMMIT_MISMATCH");
 if(!isRecord(data.screenshot))throw Error("TT44_POLICY_MISSING_SCREENSHOT");
 equals(data.screenshot.name,"tt42-owned-target.png","IMAGE_NAME");
 equals(digest(data.screenshot.sha256),hexSha256(imageBytes),"IMAGE_DIGEST_MISMATCH");
 if(!Array.isArray(data.rounds)||data.rounds.length!==2)
  throw Error("TT44_POLICY_INVALID_ROUNDS");
 for(const [i,round] of data.rounds.entries()){
  if(!isRecord(round))throw Error("TT44_POLICY_INVALID_ROUND");
  equals(round.round,i+1,"ROUND_NUMBER");
  for(const [key,expected] of Object.entries({"ui.mode":"day","ui.count":"0"}))
   equals(round.before?.[key],expected,"BEFORE_"+key);
  for(const [key,expected] of Object.entries({"ui.mode":"night","ui.count":"1"}))
   equals(round.after?.[key],expected,"AFTER_"+key);
 }
 if(!isRecord(data.assertions))throw Error("TT44_POLICY_MISSING_ASSERTIONS");
 for(const key of ["externalRequests","mutationRequests","pageExceptions"])
  equals(data.assertions[key],0,"ASSERTION_"+key);
 for(const key of ["beforeMatchesContract","afterMatchesContract","deterministicReload"])
  equals(data.assertions[key],true,"ASSERTION_"+key);
 return {
  checkedOutCommit:sha,
  receiptSha256:hexSha256(Buffer.from(rawReceipt,"utf8")),
  screenshotSha256:hexSha256(imageBytes),
  rounds:2,
  status:"LOCAL_CONTENT_CONSISTENT_NOT_AUTHENTICATED"
 };
}
export function ghAttestationVerifyArgs(file,expectedSha){
 if(file!==TT44_RECEIPT_PATH&&file!==TT44_SCREENSHOT_PATH)
  throw Error("TT44_POLICY_PATH_NOT_ALLOWED");
 const sha=commit(expectedSha);
 return ["attestation","verify",file,
  "--repo",TT44_REPOSITORY,
  "--signer-workflow",TT44_WORKFLOW,
  "--source-ref",TT44_SOURCE_REF,
  "--source-digest",sha,
  "--deny-self-hosted-runners",
  "--format","json"];
}
export function parseVerifiedCLIResponse(raw){
 let result;
 try{result=JSON.parse(raw)}catch{throw Error("TT44_CLI_INVALID_JSON")}
 if(!Array.isArray(result)||result.length===0)throw Error("TT44_CLI_NO_VERIFIED_ATTESTATIONS");
 for(const item of result){
  if(!isRecord(item)||!isRecord(item.verificationResult)||
   !isRecord(item.attestation))
   throw Error("TT44_CLI_MISSING_VERIFICATION_RESULT");
 }
 return result.length;
}
export async function readTT44Files(){
 const receipt=await readFile(TT44_RECEIPT_PATH,"utf8");
 const screenshot=await readFile(TT44_SCREENSHOT_PATH);
 return {receipt,screenshot};
}
