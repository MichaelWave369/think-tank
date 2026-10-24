import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {TT47_FILES} from "./tt47-portable-proof.mjs";
import {verifyOperatorPinnedProof,validateOperatorTrustInputs,TT51_SCHEMA}
 from "./tt51-operator-proof.mjs";
const commit="c".repeat(40),rootBytes=Buffer.from('{"trusted-root":"TEST_ONLY"}\n');
const digest=x=>createHash("sha256").update(x).digest("hex");
test("TT-51 refuses missing or forged out-of-band inputs",()=>{
 assert.deepEqual(validateOperatorTrustInputs(commit,digest(rootBytes)),
  {sourceCommit:commit,rootSha256:digest(rootBytes)});
 for(const pair of [["not-commit",digest(rootBytes)],
  [commit,"bad-root"],[commit.toUpperCase(),digest(rootBytes)]]){
  assert.throws(()=>validateOperatorTrustInputs(...pair),/TT51_/);
 }
});
test("TT-51 checks root bytes independently before invoking actual CLI verifier",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"tt51-node-"));
 let verifierCalls=0;
 const mock=async(_path,sha)=>{
  verifierCalls++;
  return {
   status:"BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT",
   verifiedSubjects:2,expectedCommit:sha,
   receiptSha256:"a".repeat(64),screenshotSha256:"b".repeat(64)
  };
 };
 try{
  await writeFile(join(dir,TT47_FILES.trustedRoot),rootBytes);
  await assert.rejects(()=>verifyOperatorPinnedProof(dir,commit,"a".repeat(64),mock),
   /TT51_INDEPENDENT_ROOT_PIN_MISMATCH/);
  assert.equal(verifierCalls,0);
  const r=await verifyOperatorPinnedProof(dir,commit,digest(rootBytes),mock);
  assert.equal(r.schema,TT51_SCHEMA);
  assert.equal(r.verifiedSubjects,2);
  assert.equal(r.operatorContext,"LOCAL_CLI_RUN_HOST_NETWORK_NOT_EVALUATED");
  assert.equal(r.summarySigned,false);
  assert.equal(r.canonicalEvidence,false);
  assert.equal(r.releaseAuthorized,false);
  assert.equal(r.antiMDone,false);
  assert.equal(verifierCalls,1);
  await assert.rejects(()=>verifyOperatorPinnedProof(dir,commit,digest(rootBytes),
   async()=>({...await mock(dir,commit),expectedCommit:"b".repeat(40)})),
   /TT51_SOURCE_COMMIT_RESPONSE_MISMATCH/);
  await assert.rejects(()=>verifyOperatorPinnedProof(dir,commit,digest(rootBytes),
   async()=>({...await mock(dir,commit),verifiedSubjects:1})),
   /TT51_BOTH_SIGNED_SUBJECTS_REQUIRED/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
