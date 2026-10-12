import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
 subjectScopedAttestationBundle,TT50_EXPECTED_PREDICATE,
 TT50_EXPECTED_STATEMENT
} from "./tt50-signed-subject-binding.mjs";
import {
 TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH,TT44_REPOSITORY
} from "./tt44-provenance-policy.mjs";
const sha=x=>createHash("sha256").update(x).digest("hex");
const source="c".repeat(40),previous="a".repeat(40);
const receipt=Buffer.from('{"test":"truth"}\n'),image=Buffer.from([137,80,78,71,13,10,26,10,2,3,4,5]);
const repo="https://github.com/"+TT44_REPOSITORY;
const workflow=".github/workflows/thinktank-owned-receipt-provenance.yml";
function bundle({commit=source,receiptBytes=receipt,imageBytes=image,
 workflowPath=workflow,subjectName="tt42-owned-target-receipt.json"}={}){
 const statement={
  _type:TT50_EXPECTED_STATEMENT,predicateType:TT50_EXPECTED_PREDICATE,
  subject:[
   {name:subjectName,digest:{sha256:sha(receiptBytes)}},
   {name:"tt42-owned-target.png",digest:{sha256:sha(imageBytes)}}
  ],
  predicate:{
   buildDefinition:{
    externalParameters:{workflow:{ref:"refs/heads/main",repository:repo,path:workflowPath}},
    internalParameters:{github:{runner_environment:"github-hosted"}},
    resolvedDependencies:[{uri:"git+"+repo+"@refs/heads/main",digest:{gitCommit:commit}}]
   },
   runDetails:{builder:{id:repo+"/"+workflow+"@refs/heads/main"}}
  }
 };
 return JSON.stringify({
  mediaType:"application/vnd.dev.sigstore.bundle.v0.3+json",
  dsseEnvelope:{payloadType:"application/vnd.in-toto+json",
   payload:Buffer.from(JSON.stringify(statement)).toString("base64"),
   signatures:[{sig:"AAAA"}]}
 })+"\n";
}
test("TT-50 selects exact signed receipt digest and independently pinned source commit",()=>{
 const historic=bundle({commit:previous});
 const current=bundle();
 const downloaded=Buffer.from(historic+current);
 const checked=subjectScopedAttestationBundle(downloaded,TT44_RECEIPT_PATH,receipt,source);
 assert.equal(checked.signedSubjectSha256,sha(receipt));
 assert.equal(checked.signedSourceCommit,source);
 assert.equal(checked.totalCandidateAttestations,2);
 assert.equal(checked.exactSubjectAttestations,1);
 assert.equal(checked.scopedJsonlBytes.toString("utf8"),current);
});
test("TT-50 rejects changed artifact bytes even if the manifest digest is edited",()=>{
 const changed=Buffer.from(receipt);changed[changed.length-1]=32;
 assert.doesNotThrow(()=>JSON.parse(changed.toString("utf8")));
 assert.notEqual(sha(changed),sha(receipt));
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(bundle()),
  TT44_RECEIPT_PATH,changed,source),/TT50_SIGNED_SUBJECT_DIGEST_MISMATCH/);
});
test("TT-50 handles shared screenshot attestations from multiple runs without trusting old commits",()=>{
 const historic=bundle({commit:previous});
 const current=bundle();
 const checked=subjectScopedAttestationBundle(Buffer.from(historic+current),
  TT44_SCREENSHOT_PATH,image,source);
 assert.equal(checked.exactSubjectAttestations,1);
 assert.equal(checked.scopedJsonlBytes.toString(),current);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(historic),
  TT44_SCREENSHOT_PATH,image,source),/TT50_SIGNED_SOURCE_IDENTITY_MISMATCH/);
});
test("TT-50 rejects unexpected workflow, missing subject, malformed digest and absent source commit",()=>{
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(bundle({workflowPath:"bad.yml"})),
  TT44_RECEIPT_PATH,receipt,source),/TT50_SIGNED_SOURCE_IDENTITY_MISMATCH/);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(bundle({subjectName:"other.json"})),
  TT44_RECEIPT_PATH,receipt,source),/TT50_SIGNED_SUBJECT_NAME_MISSING/);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(bundle()),
  TT44_RECEIPT_PATH,receipt,"bad"),/TT50_EXPECTED_SOURCE_COMMIT_REQUIRED/);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from("{broken\n"),
  TT44_RECEIPT_PATH,receipt,source),/TT50_BUNDLE_INVALID_JSON/);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.alloc(0),
  TT44_RECEIPT_PATH,receipt,source),/TT50_INVALID_BUNDLE_SIZE/);
 assert.throws(()=>subjectScopedAttestationBundle(Buffer.from(bundle()),
  "https://malicious.example/binary",receipt,source),/TT50_UNKNOWN_SUBJECT/);
});
