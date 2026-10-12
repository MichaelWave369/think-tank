import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
 offlineVerifyArgs,validatePortableManifest,TT47_DIR,TT47_FILES
} from "./tt47-portable-proof.mjs";
const sha="a".repeat(40);
const digest=x=>createHash("sha256").update(x).digest("hex");
const receipt=Buffer.from('{"test":"first-party"}\n'),image=Buffer.from([137,80,78,71,13,10,26,10,0,0]);
const bundle1=Buffer.from('{"signed":"fixture-1"}\n'),bundle2=Buffer.from('{"signed":"fixture-2"}\n');
const root=Buffer.from('{"trusted":"fixture-only"}\n');
const fakeManifest=()=>({
 schema:"thinktank.tt47-portable-proof-manifest.v1",
 status:"PORTABLE_PROOF_PACKAGE_BUILT_WITH_GITHUB_CLI",
 repository:"MichaelWave369/think-tank",
 signerWorkflow:"MichaelWave369/think-tank/.github/workflows/thinktank-owned-receipt-provenance.yml",
 expectedSourceCommit:sha,producerRunId:38197988892,
 receiptSha256:digest(receipt),screenshotSha256:digest(image),
 receiptBundleSha256:digest(bundle1),screenshotBundleSha256:digest(bundle2),
 trustedRootSha256:digest(root),reportSigned:false,releaseAuthorized:false,
 antiMDone:false,
 instructions:"Independently supply the trusted main commit SHA; verify original bytes with GitHub CLI and trusted Sigstore roots."
});
const validate=input=>validatePortableManifest(input,sha,receipt,image,bundle1,bundle2,root);
test("TT-47 fixes file names and requires both local bundle and trusted root",()=>{
 assert.equal(TT47_DIR,"artifacts/observatory/tt47-portable");
 assert.equal(Object.keys(TT47_FILES).length,6);
 for(const [subject,local,bundle] of [
  ["artifacts/observatory/tt42-owned-target-receipt.json","/proof/receipt.json","/proof/receipt.jsonl"],
  ["artifacts/observatory/tt42-owned-target.png","/proof/image.png","/proof/image.jsonl"]
 ]){
  const args=offlineVerifyArgs(subject,local,sha,bundle,"/proof/trusted-root.jsonl");
  assert.equal(args[2],local);
  assert.equal(args[args.indexOf("--source-digest")+1],sha);
  assert.equal(args[args.indexOf("--signer-workflow")+1],
   "MichaelWave369/think-tank/.github/workflows/thinktank-owned-receipt-provenance.yml");
  assert.equal(args[args.indexOf("--bundle")+1],bundle);
  assert.equal(args[args.indexOf("--custom-trusted-root")+1],"/proof/trusted-root.jsonl");
 }
 assert.throws(()=>offlineVerifyArgs("https://example.com","x",sha,"b","root"),/OUT_OF_SCOPE/);
 assert.throws(()=>offlineVerifyArgs("artifacts/observatory/tt42-owned-target.png","x","x","b","r"),/EXPECTED_COMMIT/);
});
test("TT-47 portable manifest is a nonauthoritative integrity index, not a signature",()=>{
 assert.equal(validate(fakeManifest()),true);
 for(const [key,value] of [
  ["releaseAuthorized",true],["antiMDone",true],["reportSigned",true],
  ["expectedSourceCommit","b".repeat(40)],["repository","someone/else"],
  ["signerWorkflow","someone/else"],["receiptBundleSha256","0".repeat(64)],
  ["trustedRootSha256","0".repeat(64)],["receiptSha256","0".repeat(64)],
  ["producerRunId",0]
 ]){
  const altered={...fakeManifest(),[key]:value};
  assert.throws(()=>validate(altered),/TT47_/);
 }
 assert.throws(()=>validate({...fakeManifest(),arbitrarySignature:"YES"}),/SCHEMA_FIELDS/);
});
test("TT-47 checks SHA of root and bundles using actual selected bytes",()=>{
 assert.throws(()=>validatePortableManifest(fakeManifest(),sha,receipt,image,
  Buffer.from("tampered-bundle"),bundle2,root),/MANIFEST_receiptBundleSha256/);
 assert.throws(()=>validatePortableManifest(fakeManifest(),sha,receipt,image,
  bundle1,bundle2,Buffer.from("different-root")) ,/MANIFEST_trustedRootSha256/);
 assert.throws(()=>validatePortableManifest(fakeManifest(),sha,receipt,
  Buffer.from("different-image"),bundle1,bundle2,root),/MANIFEST_screenshotSha256/);
});
