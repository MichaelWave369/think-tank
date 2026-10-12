import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {
 TT46_CHALLENGE_IDS,mutateReceiptBytes,mutateScreenshotBytes,
 differentCommit,challengeArgs,classifyVerifierExit
} from "./tt46-adversarial-attestations.mjs";
const sha="c".repeat(40),hash=x=>createHash("sha256").update(x).digest("hex");
const receipt=Buffer.from('{"schema":"test","mode":"day"}\n',"utf8");
const screenshot=Buffer.from([137,80,78,71,13,10,26,10,0,1,2,3,4,5,6,7,8,9]);

test("TT46 byte mutations are deterministic, digest-different and preserve valid receipt JSON",()=>{
 const altered=mutateReceiptBytes(receipt);
 assert.doesNotThrow(()=>JSON.parse(altered.toString("utf8")));
 assert.notEqual(hash(receipt),hash(altered));
 assert.equal(receipt.at(-1),10);
 assert.equal(altered.at(-1),32);
 const newImage=mutateScreenshotBytes(screenshot);
 assert.notEqual(hash(screenshot),hash(newImage));
 assert.deepEqual(newImage.subarray(0,8),screenshot.subarray(0,8));
 assert.throws(()=>mutateReceiptBytes(Buffer.from("{}")) ,/TERMINAL_NEWLINE/);
 assert.throws(()=>mutateScreenshotBytes(Buffer.from([1,2])),/TOO_SMALL/);
});

test("TT46 challenge identity cannot escape the owned fixture and fixed gh signer",()=>{
 assert.deepEqual(TT46_CHALLENGE_IDS,[
  "ALTERED_RECEIPT_BYTES","ALTERED_SCREENSHOT_BYTES",
  "WRONG_SOURCE_COMMIT","WRONG_SIGNING_WORKFLOW"
 ]);
 const receiptPath="/tmp/tt46/altered-receipt.json";
 const pngPath="/tmp/tt46/altered-image.png";
 const args=challengeArgs("ALTERED_RECEIPT_BYTES",receiptPath,sha);
 assert.equal(args[2],receiptPath);
 assert.equal(args[args.indexOf("--source-digest")+1],sha);
 assert.equal(challengeArgs("ALTERED_SCREENSHOT_BYTES",pngPath,sha)[2],pngPath);
 const otherSha=challengeArgs("WRONG_SOURCE_COMMIT","/tmp/receipt",sha);
 assert.equal(otherSha[otherSha.indexOf("--source-digest")+1],differentCommit(sha));
 assert.notEqual(differentCommit(sha),sha);
 const wrongSigner=challengeArgs("WRONG_SIGNING_WORKFLOW","/tmp/receipt",sha);
 assert.equal(wrongSigner[wrongSigner.indexOf("--signer-workflow")+1],
  "MichaelWave369/think-tank/.github/workflows/ci.yml");
 assert.throws(()=>challengeArgs("ARBITRARY_URL","https://example.com",sha),/UNKNOWN_CHALLENGE/);
 assert.throws(()=>differentCommit("invalid"),/INVALID_COMMIT/);
});
test("TT46 only accepts cryptographic rejection with subsequent successful positive checks",()=>{
 assert.equal(classifyVerifierExit({status:1,error:undefined,signal:null},"expected-rejection"),
  "REJECTED_BY_VERIFIER");
 assert.throws(()=>classifyVerifierExit({status:0,signal:null},"expected-rejection"),
  /CRYPTOGRAPHIC_NEGATIVE_CONTROL_ACCEPTED/);
 assert.throws(()=>classifyVerifierExit({status:null,signal:"SIGTERM"},"expected-rejection"),
  /INFRA_FAILURE/);
 assert.throws(()=>classifyVerifierExit({status:1,error:new Error("offline")},"expected-rejection"),
  /INFRA_FAILURE/);
 assert.throws(()=>classifyVerifierExit({status:1,signal:null},"positive-control"),
  /POSITIVE_REVERIFY_FAILED/);
 assert.throws(()=>classifyVerifierExit({status:0,stdout:"[]"},"positive-control"),
  /NO_VERIFIED_ATTESTATIONS/);
 assert.equal(classifyVerifierExit({status:0,signal:null,stdout:JSON.stringify([
  {attestation:{},verificationResult:{}}
 ])},"positive-control"),"VERIFIED_BY_VERIFIER");
});
