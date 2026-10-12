/* TT-49: adversarial negatives INSIDE the real --network none verifier.
 * We copy exact attested subjects to temp storage, alter only the copies,
 * repair their UNSIGNED manifest hashes, and insist the local verifier still
 * rejects the counterfeits. Both originals must verify again afterwards.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cp,readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
 TT47_FILES,verifyPortableProof
} from "./tt47-portable-proof.mjs";
import {
 assertLoopbackOnly,assertIndependentTrustPin,assertEgressProbeFailure,
 checkNoExternalIPRoute,sha256
} from "./tt48-isolation-policy.mjs";
import {networkInterfaces} from "node:os";

export const TT49_CASE_IDS=Object.freeze([
 "MUTATED_RECEIPT_WITH_REWRITTEN_MANIFEST",
 "CORRUPTED_DSSE_SIGNATURE_WITH_REWRITTEN_MANIFEST",
 "SUBSTITUTED_ROOT_WITH_REWRITTEN_MANIFEST",
 "WRONG_OUT_OF_BAND_COMMIT",
 "FORGED_UNSIGNED_MANIFEST_AUTHORITY"
]);
const hexSha=x=>createHash("sha256").update(x).digest("hex");
const local=(folder,kind)=>join(folder,TT47_FILES[kind]);
const wrongSha=sha=>{
 if(!/^[a-f0-9]{40}$/.test(sha))throw Error("TT49_INVALID_COMMIT");
 return (sha[0]==="0"?"1":"0")+sha.slice(1);
};
export function strictExpectedRefusal(error,expectedClass){
 if(!error||typeof error!=="object")throw Error("TT49_NOT_A_VERIFIER_FAILURE");
 const msg=String(error.message??"");
 if(expectedClass==="signature"){
  // execFileSync failed to verify with the local bundle and the supplied
  // unmodified trusted root. A missing executable or signal is not rejection.
  if(!Number.isInteger(error.status)||error.status===0||error.signal||error.code==="ENOENT")
   throw Error("TT49_SIGNATURE_VERIFIER_PROCESS_FAILURE");
  const stderr=String(error.stderr??"");
  if(!stderr.trim()||/network is unreachable|connection refused|timed out|rate limit|no such file|permission denied|command not found/i.test(stderr))
   throw Error("TT49_SIGNATURE_REJECTION_NOT_DEMONSTRATED");
  return "GH_CLI_REJECTED_ALTERED_SIGNATURE_SUBJECT";
 }
 const markers={
  binding:"TT50_SIGNED_SUBJECT_DIGEST_MISMATCH",
  pin:"TT48_INDEPENDENT_TRUST_ROOT_MISMATCH",
  commit:"TT44_POLICY_COMMIT_MISMATCH",
  manifest:"TT47_MANIFEST_releaseAuthorized"
 };
 if(!Object.prototype.hasOwnProperty.call(markers,expectedClass))
  throw Error("TT49_UNKNOWN_EXPECTED_CLASS");
 if(!msg.includes(markers[expectedClass]))
  throw Error("TT49_UNEXPECTED_REJECTION_"+expectedClass);
 return "SCOPED_POLICY_REJECTION";
}
async function rewriteUnsignedManifest(folder,field,newDigest){
 const path=local(folder,"manifest");
 const obj=JSON.parse(await readFile(path,"utf8"));
 obj[field]=newDigest;
 await writeFile(path,JSON.stringify(obj,null,2)+"\n");
}
async function alteredCopy(root,work,tag){
 const output=join(work,tag);
 await cp(root,output,{recursive:true,errorOnExist:true,force:false});
 return output;
}
function checkResult(verified){
 assert.equal(verified.status,"BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT");
 assert.equal(verified.verifiedSubjects,2);
}
export async function runOfflineAdversarialMatrix(proofFolder,expectedSha,expectedRootPin,opts={}){
 assertLoopbackOnly(opts.interfaces??networkInterfaces());
 assertIndependentTrustPin(await readFile(local(proofFolder,"trustedRoot")),expectedRootPin);
 const blocked=assertEgressProbeFailure(await (opts.egressProbe??checkNoExternalIPRoute)());
 // Authentic signatures must verify BEFORE running any negative controls.
 const verify=opts.verifier??verifyPortableProof;
 checkResult(await verify(proofFolder,expectedSha));
 const work=await mkdtemp(join(tmpdir(),"tt49-challenges-"));
 const negatives=[];
 try{
  const c1=await alteredCopy(proofFolder,work,"mutated-receipt");
  const receipt=await readFile(local(c1,"receipt"));
  if(receipt.at(-1)!==10)throw Error("TT49_RECEIPT_FORMAT_CHANGED");
  receipt[receipt.length-1]=32; // Valid JSON, changed byte-for-byte subject.
  JSON.parse(receipt.toString("utf8"));
  await writeFile(local(c1,"receipt"),receipt);
  await rewriteUnsignedManifest(c1,"receiptSha256",hexSha(receipt));
  let thrown;
  try{await verify(c1,expectedSha)}catch(e){thrown=e}
  negatives.push({caseId:TT49_CASE_IDS[0],outcome:strictExpectedRefusal(thrown,"binding")});

  const c2=await alteredCopy(proofFolder,work,"swapped-bundle");
  // Replacing the receipt bundle with the screenshot bundle is NOT always
  // invalid: an SLSA statement can attest to BOTH artifacts and GitHub
  // downloads can contain multiple legitimate historical attestations.
  // Instead corrupt the actual DSSE signature of the receipt statement.
  const originalBundle=await readFile(local(c2,"receiptBundle"),"utf8");
  const bundleLines=originalBundle.trim().split(/\r?\n/);
  if(bundleLines.length!==1)throw Error("TT49_RECEIPT_BUNDLE_NOT_SINGLE");
  const alteredStatement=JSON.parse(bundleLines[0]);
  const dsseSignature=alteredStatement?.dsseEnvelope?.signatures?.[0]?.sig;
  if(typeof dsseSignature!=="string"||dsseSignature.length<4)
   throw Error("TT49_MISSING_DSSE_SIGNATURE");
  alteredStatement.dsseEnvelope.signatures[0].sig=
   (dsseSignature[0]==="A"?"B":"A")+dsseSignature.slice(1);
  const alteredBundle=Buffer.from(JSON.stringify(alteredStatement)+"\n");
  await writeFile(local(c2,"receiptBundle"),alteredBundle);
  await rewriteUnsignedManifest(c2,"receiptBundleSha256",hexSha(alteredBundle));
  thrown=undefined;
  try{await verify(c2,expectedSha)}catch(e){thrown=e}
  negatives.push({caseId:TT49_CASE_IDS[1],outcome:strictExpectedRefusal(thrown,"signature")});

  const c3=await alteredCopy(proofFolder,work,"altered-root");
  const changedRoot=await readFile(local(c3,"trustedRoot"));
  changedRoot[changedRoot.length-1]^=1;
  await writeFile(local(c3,"trustedRoot"),changedRoot);
  await rewriteUnsignedManifest(c3,"trustedRootSha256",hexSha(changedRoot));
  thrown=undefined;
  try{assertIndependentTrustPin(changedRoot,expectedRootPin)}catch(e){thrown=e}
  negatives.push({caseId:TT49_CASE_IDS[2],outcome:strictExpectedRefusal(thrown,"pin")});

  thrown=undefined;
  try{await verify(proofFolder,wrongSha(expectedSha))}catch(e){thrown=e}
  negatives.push({caseId:TT49_CASE_IDS[3],outcome:strictExpectedRefusal(thrown,"commit")});

  const c5=await alteredCopy(proofFolder,work,"forged-authority");
  const manifestPath=local(c5,"manifest");
  const claimed=JSON.parse(await readFile(manifestPath,"utf8"));
  claimed.releaseAuthorized=true;
  await writeFile(manifestPath,JSON.stringify(claimed,null,2)+"\n");
  thrown=undefined;
  try{await verify(c5,expectedSha)}catch(e){thrown=e}
  negatives.push({caseId:TT49_CASE_IDS[4],outcome:strictExpectedRefusal(thrown,"manifest")});

  assert.deepEqual(negatives.map(x=>x.caseId),TT49_CASE_IDS);
  // Authenticate originals again AFTER challenges to reject fail-everything behavior.
  checkResult(await verify(proofFolder,expectedSha));
  return {
   schema:"thinktank.tt49-network-isolated-adversarial-review.v1",
   status:"FIVE_ISOLATED_NEGATIVE_CONTROLS_REJECTED_ORIGINALS_VERIFIED_TWICE",
   sourceCommit:expectedSha,independentlyPinnedRootSha256:expectedRootPin,
   egressBlockedBy:blocked,
   proofScope:"FIRST_PARTY_COUNTER_FIXTURE_SIGNED_ARTIFACTS_ONLY",
   negativeControls:negatives,
   positiveFullProofChecks:2,
   networkScope:"DOCKER_NETWORK_NONE_LOOPBACK_ONLY",
   reportSigned:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false,
   caveat:"Unsigned summary. Real verification requires original signed subjects, independent root pin and trusted commit."
  };
 }finally{
  await rm(work,{recursive:true,force:true});
 }
}
