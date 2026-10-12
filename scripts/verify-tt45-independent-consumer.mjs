/* TT-45: second, independent read-only GitHub Actions verification job.
 * Downloads a fixed artifact from one verified main-branch producer run.
 * No arbitrary URLs, no shell interpretation, no re-signing, no promotion.
 */
import {execFileSync} from "node:child_process";
import {mkdtemp,readFile,lstat,mkdir,writeFile,rm} from "node:fs/promises";
import {join,dirname,resolve,relative,isAbsolute} from "node:path";
import {tmpdir} from "node:os";
import {
 TT44_REPOSITORY,TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH
} from "./tt44-provenance-policy.mjs";
import {
 TT45_ARTIFACT_NAME,parseProducerRunId,validateProducerRun,
 validateConsumerArtifactFiles,consumerVerificationArgs,
 requireGitHubVerifiedOutput,consumerSummary
} from "./tt45-consumer-policy.mjs";

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
  const receipt=await fileReadWithinDirectory(folder,TT44_RECEIPT_PATH);
  const png=await fileReadWithinDirectory(folder,TT44_SCREENSHOT_PATH);
  const contents=validateConsumerArtifactFiles(receipt,png,producer.commit);
  for(const subject of [TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH]){
   const original=resolve(folder,subject);
   const args=consumerVerificationArgs(original,producer.commit);
   // The CLI must cryptographically validate exact subject bytes and identity.
   // We do not accept a user-supplied, editable "verified" JSON report.
   const cliOutput=cli(args);
   requireGitHubVerifiedOutput(cliOutput);
  }
  const report={
   ...consumerSummary(producer,contents,2),
   verifiedAt:new Date().toISOString(),
   sourceArtifact:TT45_ARTIFACT_NAME
  };
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+"\n");
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
