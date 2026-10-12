/* TT-46: cryptographic negative controls against genuine TT-44 subjects.
 * All four challenges run in the read-only TT-45 consumer job. We NEVER
 * interpret a nonzero gh exit as proof unless fresh positive verifications
 * also succeed in the same run.
 */
import {spawnSync} from "node:child_process";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {
 TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH,TT44_WORKFLOW
} from "./tt44-provenance-policy.mjs";
import {
 consumerVerificationArgs,requireGitHubVerifiedOutput
} from "./tt45-consumer-policy.mjs";

const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
const WRONG_SIGNER="MichaelWave369/think-tank/.github/workflows/ci.yml";
export const TT46_CHALLENGE_IDS=[
 "ALTERED_RECEIPT_BYTES","ALTERED_SCREENSHOT_BYTES",
 "WRONG_SOURCE_COMMIT","WRONG_SIGNING_WORKFLOW"
];

export function mutateReceiptBytes(raw){
 if(!(raw instanceof Uint8Array)||raw.length<2||raw[raw.length-1]!==10)
  throw Error("TT46_RECEIPT_EXPECTED_TERMINAL_NEWLINE");
 const changed=Buffer.from(raw);
 changed[changed.length-1]=32; // newline -> space; still valid JSON, different signed bytes
 try{JSON.parse(changed.toString("utf8"))}
 catch{throw Error("TT46_RECEIPT_MUTATION_NOT_VALID_JSON")}
 if(digest(changed)===digest(raw))throw Error("TT46_RECEIPT_UNCHANGED");
 return changed;
}
export function mutateScreenshotBytes(raw){
 if(!(raw instanceof Uint8Array)||raw.length<16)
  throw Error("TT46_SCREENSHOT_TOO_SMALL");
 const changed=Buffer.from(raw);
 changed[changed.length-1]^=1;
 if(digest(changed)===digest(raw))throw Error("TT46_IMAGE_UNCHANGED");
 return changed;
}
export function differentCommit(sha){
 if(typeof sha!=="string"||!/^[a-f0-9]{40}$/.test(sha))
  throw Error("TT46_INVALID_COMMIT");
 return (sha[0]==="a"?"b":"a")+sha.slice(1);
}
export function challengeArgs(id,path,sha){
 const isImage=id==="ALTERED_SCREENSHOT_BYTES";
 const subject=isImage?TT44_SCREENSHOT_PATH:TT44_RECEIPT_PATH;
 const args=consumerVerificationArgs(subject,path,sha);
 if(id==="WRONG_SOURCE_COMMIT"){
  args[args.indexOf("--source-digest")+1]=differentCommit(sha);
 }else if(id==="WRONG_SIGNING_WORKFLOW"){
  args[args.indexOf("--signer-workflow")+1]=WRONG_SIGNER;
 }else if(id!=="ALTERED_RECEIPT_BYTES"&&id!=="ALTERED_SCREENSHOT_BYTES"){
  throw Error("TT46_UNKNOWN_CHALLENGE");
 }
 return args;
}
export function classifyVerifierExit(result,kind){
 if(!result||result.error||result.signal||!Number.isInteger(result.status))
  throw Error("TT46_VERIFIER_INFRA_FAILURE_"+kind);
 if(kind==="expected-rejection"){
  if(result.status===0)throw Error("TT46_CRYPTOGRAPHIC_NEGATIVE_CONTROL_ACCEPTED");
  return "REJECTED_BY_VERIFIER";
 }
 if(result.status!==0)throw Error("TT46_POSITIVE_REVERIFY_FAILED");
 requireGitHubVerifiedOutput(result.stdout);
 return "VERIFIED_BY_VERIFIER";
}
function runCLI(args){
 const r=spawnSync("gh",args,{
  encoding:"utf8",timeout:120000,maxBuffer:4*1024*1024,
  stdio:["ignore","pipe","pipe"],
  env:{...process.env,GH_PROMPT_DISABLED:"1"}
 });
 if(r.error)throw Error("TT46_GH_PROCESS_ERROR_"+r.error.code);
 return r;
}
export async function challengeLiveAttestations({receiptBytes,imageBytes,sha,receiptPath,imagePath}){
 if(!Buffer.isBuffer(receiptBytes)||!Buffer.isBuffer(imageBytes))
  throw Error("TT46_ORIGINAL_BYTES_REQUIRED");
 if(!receiptPath||!imagePath)throw Error("TT46_ORIGINAL_PATHS_REQUIRED");
 const alteredReceipt=mutateReceiptBytes(receiptBytes);
 const alteredImage=mutateScreenshotBytes(imageBytes);
 const work=await mkdtemp(join(tmpdir(),"tt46-challenges-"));
 try{
  const receipt=join(work,"altered-receipt.json");
  const screenshot=join(work,"altered-screenshot.png");
  await writeFile(receipt,alteredReceipt);
  await writeFile(screenshot,alteredImage);
  const cases=[
   {id:TT46_CHALLENGE_IDS[0],path:receipt,sha256:digest(alteredReceipt)},
   {id:TT46_CHALLENGE_IDS[1],path:screenshot,sha256:digest(alteredImage)},
   {id:TT46_CHALLENGE_IDS[2],path:receiptPath,sha256:digest(receiptBytes)},
   {id:TT46_CHALLENGE_IDS[3],path:receiptPath,sha256:digest(receiptBytes)}
  ];
  const checks=[];
  for(const item of cases){
   const result=runCLI(challengeArgs(item.id,item.path,sha));
   const outcome=classifyVerifierExit(result,"expected-rejection");
   checks.push({id:item.id,outcome,sha256:item.sha256});
  }
  const controls=[
   {subject:"receipt",path:receiptPath,expected:digest(receiptBytes)},
   {subject:"screenshot",path:imagePath,expected:digest(imageBytes)}
  ];
  for(const item of controls){
   const subject=item.subject==="receipt"?TT44_RECEIPT_PATH:TT44_SCREENSHOT_PATH;
   const result=runCLI(consumerVerificationArgs(subject,item.path,sha));
   classifyVerifierExit(result,"positive-control");
  }
  if(checks.length!==TT46_CHALLENGE_IDS.length)throw Error("TT46_INCOMPLETE_SUITE");
  return {
   schema:"thinktank.tt46-adversarial-verification.v1",
   status:"NEGATIVE_CHALLENGES_REJECTED_AND_POSITIVE_CONTROLS_VERIFIED",
   expectedSigner:TT44_WORKFLOW,
   expectedCommit:sha,
   negativeChecks:checks,
   positiveReverification:["original-receipt","original-screenshot"],
   scope:"FIRST_PARTY_OWNED_COUNTER_ARTIFACTS_ONLY",
   summarySigned:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false
  };
 }finally{
  await rm(work,{recursive:true,force:true});
 }
}
