/* TT-45: second, independent read-only GitHub Actions verification job.
 * Downloads a fixed artifact from one verified main-branch producer run.
 * No arbitrary URLs, no shell interpretation, no re-signing, no promotion.
 */
import {execFileSync} from "node:child_process";
import {mkdtemp,readFile,lstat,realpath,mkdir,writeFile,rm} from "node:fs/promises";
import {join,dirname,resolve,relative,isAbsolute,basename} from "node:path";
import {tmpdir} from "node:os";
import {
 TT44_REPOSITORY,TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH
} from "./tt44-provenance-policy.mjs";
import {
 TT45_ARTIFACT_NAME,parseProducerRunId,validateProducerRun,
 validateConsumerArtifactFiles,consumerVerificationArgs,
 requireGitHubVerifiedOutput,consumerSummary
} from "./tt45-consumer-policy.mjs";
import {challengeLiveAttestations} from "./tt46-adversarial-attestations.mjs";
import {createPortableProof} from "./tt47-portable-proof.mjs";

const output="artifacts/observatory/tt45-independent-consumer-review.json";
const cli=(args,{maxBuffer=4*1024*1024}={})=>execFileSync("gh",args,{
 encoding:"utf8",timeout:120000,maxBuffer,env:{...process.env,GH_PROMPT_DISABLED:"1"}
});
function requireContext(){
 if(process.env.GITHUB_REPOSITORY!==TT44_REPOSITORY)
  throw Error("TT45_CONSUMER_WRONG_REPOSITORY");
 if(process.env.GITHUB_REF!=="refs/heads/main")
  throw Error("TT45_CONSUMER_MAIN_ONLY");
 if(process.env.GITHUB_EVENT_NAME!=="workflow_run")
  throw Error("TT45_CONSUMER_REQUIRES_WORKFLOW_RUN");
 if(!process.env.GH_TOKEN)throw Error("TT45_CONSUMER_TOKEN_REQUIRED");
 return parseProducerRunId(process.env.TT45_PRODUCER_RUN_ID);
}
async function fileReadWithinDirectory(root,filename){
 const file=resolve(root,filename);
 const rel=relative(root,file);
 if(rel.startsWith("..")||isAbsolute(rel))
  throw Error("TT45_CONSUMER_PATH_ESCAPE");
 const stat=await lstat(file);
 if(!stat.isFile()||stat.isSymbolicLink())throw Error("TT45_CONSUMER_NOT_REGULAR_FILE");
 const actual=await realpath(file),base=await realpath(root);
 const resolvedRelative=relative(base,actual);
 if(resolvedRelative.startsWith("..")||isAbsolute(resolvedRelative))
  throw Error("TT45_CONSUMER_REALPATH_ESCAPE");
 return readFile(file);
}
async function main(){
 const id=requireContext();
 const api="repos/"+TT44_REPOSITORY+"/actions/runs/"+id;
 const producer=validateProducerRun(JSON.parse(cli(["api",api])),id);
 let folder;
 try{
  folder=await mkdtemp(join(tmpdir(),"tt45-consumer-"));
  cli(["run","download",String(id),"--repo",TT44_REPOSITORY,
   "--name",TT45_ARTIFACT_NAME,"--dir",folder],{maxBuffer:8*1024*1024});
  const receipt=await fileReadWithinDirectory(folder,basename(TT44_RECEIPT_PATH));
  const png=await fileReadWithinDirectory(folder,basename(TT44_SCREENSHOT_PATH));
  const contents=validateConsumerArtifactFiles(receipt,png,producer.commit);
  for(const subject of [TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH]){
   const original=resolve(folder,basename(subject));
   const args=consumerVerificationArgs(subject,original,producer.commit);
   // The CLI must cryptographically validate exact subject bytes and identity.
   // We do not accept a user-supplied, editable "verified" JSON report.
   const cliOutput=cli(args);
   requireGitHubVerifiedOutput(cliOutput);
  }
  // TT-46: adversarial CLI checks use real downloaded subject bytes, never mock signatures.
  // Positive cryptographic re-verification follows all rejection challenges.
  const adversarial=await challengeLiveAttestations({
   receiptBytes:receipt,imageBytes:png,sha:producer.commit,
   receiptPath:resolve(folder,basename(TT44_RECEIPT_PATH)),
   imagePath:resolve(folder,basename(TT44_SCREENSHOT_PATH))
  });
  // TT-47: package exact original subjects with downloaded Sigstore bundles
  // and a fresh trusted root, then verify using only those local materials.
  const portable=await createPortableProof({
   producerRunId:id,expectedCommit:producer.commit,
   receiptBytes:receipt,imageBytes:png,
   receiptPath:resolve(folder,basename(TT44_RECEIPT_PATH)),
   imagePath:resolve(folder,basename(TT44_SCREENSHOT_PATH))
  });
  if(portable.verifiedSubjects!==2)
   throw Error("TT47_INCOMPLETE_LOCAL_PROOF_VERIFICATION");
  const report={
   ...consumerSummary(producer,contents,2),
   verifiedAt:new Date().toISOString(),
   sourceArtifact:TT45_ARTIFACT_NAME
  };
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+"\n");
  const tt46Output="artifacts/observatory/tt46-adversarial-verification-review.json";
  const tt46Report={
   ...adversarial,producerRunId:id,
   originalReceiptSha256:contents.receiptSha256,
   originalScreenshotSha256:contents.screenshotSha256,
   reviewedAt:new Date().toISOString(),
   caveat:"This is an unsigned machine report. Only a fresh CLI verification of original subjects can authenticate its claims."
  };
  await writeFile(tt46Output,JSON.stringify(tt46Report,null,2)+"\n");
  console.log("TT46_ADVERSARIAL_PROVENANCE_PASS",JSON.stringify({
   producerRunId:id,negativeRejections:adversarial.negativeChecks.length,
   positiveReverifications:adversarial.positiveReverification.length,
   releaseAuthorized:false,antiMDone:false
  }));
  console.log("TT45_INDEPENDENT_CONSUMER_VERIFIED",JSON.stringify({
   producerRunId:id,expectedMainSha:producer.commit,subjects:2,
   receiptSha256:report.receiptSha256,
   screenshotSha256:report.screenshotSha256,
   canonicalEvidence:false,antiMDone:false
  }));
 }finally{
  if(folder)await rm(folder,{recursive:true,force:true});
 }
}
await main();
