import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {
 TT49_CASE_IDS,strictExpectedRefusal,runOfflineAdversarialMatrix
} from "./tt49-offline-adversarial.mjs";
import {TT47_FILES} from "./tt47-portable-proof.mjs";

const sha="b".repeat(40),hash=x=>createHash("sha256").update(x).digest("hex");
const ghError=()=>{
 const e=new Error("Command failed: gh attestation verify");
 e.status=1;e.signal=null;e.stderr="attestation verification failed: invalid DSSE signature";
 return e;
};
const originalReceipt=Buffer.from('{"schema":"test-owned-app"}\n');
const root=Buffer.from('{"trusted":"test-only"}\n');
const digest=hash(root);
const folderFiles=Object.values(TT47_FILES);
const fakeDSSE=Buffer.from(JSON.stringify({
 dsseEnvelope:{
  payloadType:"application/vnd.in-toto+json",
  payload:Buffer.from('{"_type":"fixture"}').toString("base64"),
  signatures:[{sig:"SGVsbG8="}]
 }
})+"\n");
test("TT-49 scopes five fixed challenges, not arbitrary URLs or software targets",()=>{
 assert.deepEqual(TT49_CASE_IDS,[
  "MUTATED_RECEIPT_WITH_REWRITTEN_MANIFEST",
  "CORRUPTED_DSSE_SIGNATURE_WITH_REWRITTEN_MANIFEST",
  "SUBSTITUTED_ROOT_WITH_REWRITTEN_MANIFEST",
  "WRONG_OUT_OF_BAND_COMMIT",
  "FORGED_UNSIGNED_MANIFEST_AUTHORITY"
 ]);
 assert.equal(folderFiles.length,6);
});
test("TT-49 refuses error laundering and accepts only specified rejection classes",()=>{
 assert.equal(strictExpectedRefusal(ghError(),"signature"),"GH_CLI_REJECTED_ALTERED_SIGNATURE_SUBJECT");
 for(const e of [
  undefined,
  Object.assign(new Error("gh not found"),{code:"ENOENT"}),
  Object.assign(new Error("gh timed out"),{signal:"SIGTERM",status:null}),
  Object.assign(new Error("gh returned 0"),{status:0,stderr:"anything"}),
  Object.assign(new Error("network down"),{status:1,stderr:"connection refused"})
 ]){
  assert.throws(()=>strictExpectedRefusal(e,"signature"),/TT49_/);
 }
 assert.equal(strictExpectedRefusal(
  Error("TT50_SIGNED_SUBJECT_DIGEST_MISMATCH"),"binding"),"SCOPED_POLICY_REJECTION");
 assert.equal(strictExpectedRefusal(
  Error("TT48_INDEPENDENT_TRUST_ROOT_MISMATCH"),"pin"),"SCOPED_POLICY_REJECTION");
 assert.equal(strictExpectedRefusal(
  Error("TT44_POLICY_COMMIT_MISMATCH"),"commit"),"SCOPED_POLICY_REJECTION");
 assert.equal(strictExpectedRefusal(
  Error("TT47_MANIFEST_releaseAuthorized"),"manifest"),"SCOPED_POLICY_REJECTION");
 assert.throws(()=>strictExpectedRefusal(Error("wrong error"),"binding"),/UNEXPECTED_REJECTION/);
 assert.throws(()=>strictExpectedRefusal(Error("any"),"unknown"),/UNKNOWN_EXPECTED_CLASS/);
});
test("TT-49 rechecks genuine proof both before and after five rejected copies",async()=>{
 const rootdir=await mkdtemp(join(tmpdir(),"tt49-node-"));
 const folder=join(rootdir,"proof");
 try{
  await mkdir(folder);
  const contents={
   receipt:originalReceipt,
   screenshot:Buffer.from([137,80,78,71,13,10,26,10,0,0,1]),
   receiptBundle:fakeDSSE,
   screenshotBundle:Buffer.from('{"attestation":"screenshot"}\n'),
   trustedRoot:root,manifest:Buffer.from('{"releaseAuthorized":false}\n')
  };
  await Promise.all(Object.entries(contents).map(([kind,bytes])=>
   writeFile(join(folder,TT47_FILES[kind]),bytes)));
  const originalReceiptDigest=hash(contents.receipt);
  const originalBundleDigest=hash(contents.receiptBundle);
  let positive=0,binding=0,signature=0;
  const mockVerifier=async(path,commit)=>{
   const receipt=await readFile(join(path,TT47_FILES.receipt));
   const receiptBundle=await readFile(join(path,TT47_FILES.receiptBundle));
   const manifest=JSON.parse(await readFile(join(path,TT47_FILES.manifest),"utf8"));
   if(commit!==sha)throw Error("TT44_POLICY_COMMIT_MISMATCH");
   if(manifest.releaseAuthorized===true)throw Error("TT47_MANIFEST_releaseAuthorized");
   if(hash(receipt)!==originalReceiptDigest){
    binding++;throw Error("TT50_SIGNED_SUBJECT_DIGEST_MISMATCH");
   }
   if(hash(receiptBundle)!==originalBundleDigest){
    signature++;throw ghError();
   }
   positive++;
   return {verifiedSubjects:2,status:"BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT"};
  };
  const result=await runOfflineAdversarialMatrix(folder,sha,digest,{
   interfaces:{lo:[{internal:true,address:"127.0.0.1"}]},
   egressProbe:async()=>"ENETUNREACH",verifier:mockVerifier
  });
  assert.equal(result.negativeControls.length,5);
  assert.equal(result.positiveFullProofChecks,2);
  assert.equal(binding,1);
  assert.equal(signature,1);
  assert.equal(positive,2);
  assert.equal(result.releaseAuthorized,false);
  assert.equal(result.canonicalEvidence,false);
  assert.equal(result.antiMDone,false);
  assert.equal(hash(await readFile(join(folder,TT47_FILES.receipt))),originalReceiptDigest);
  assert.equal(hash(await readFile(join(folder,TT47_FILES.receiptBundle))),originalBundleDigest);
 }finally{await rm(rootdir,{recursive:true,force:true})}
});
