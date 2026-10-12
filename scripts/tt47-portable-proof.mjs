/* TT-47: portable, read-only GitHub attestation proof package.
 * Bundle/signature verification is delegated to GitHub CLI and a trusted
 * Sigstore root. The manifest is deliberately UNSIGNED and untrusted.
 */
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdir,readFile,readdir,lstat,writeFile,mkdtemp,rm} from "node:fs/promises";
import {join,resolve,relative,isAbsolute} from "node:path";
import {tmpdir} from "node:os";
import {TT44_REPOSITORY,TT44_WORKFLOW,TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH}
 from "./tt44-provenance-policy.mjs";
import {validateConsumerArtifactFiles,consumerVerificationArgs,requireGitHubVerifiedOutput}
 from "./tt45-consumer-policy.mjs";
import {subjectScopedAttestationBundle} from "./tt50-signed-subject-binding.mjs";

export const TT47_DIR="artifacts/observatory/tt47-portable";
export const TT47_FILES=Object.freeze({
 receipt:"tt42-owned-target-receipt.json",
 screenshot:"tt42-owned-target.png",
 receiptBundle:"tt42-owned-target-receipt.attestation.jsonl",
 screenshotBundle:"tt42-owned-target.attestation.jsonl",
 trustedRoot:"trusted-root.jsonl",
 manifest:"portable-proof-manifest.json"
});
const sha256=x=>createHash("sha256").update(x).digest("hex");
const fail=why=>{throw Error("TT47_"+why)};
const isHex=(x,size)=>typeof x==="string"&&new RegExp("^[a-f0-9]{"+size+"}$").test(x);
const maxSizes={
 receipt:131072,screenshot:3145728,receiptBundle:4194304,
 screenshotBundle:4194304,trustedRoot:4194304,manifest:16384
};
function gh(args,options={}){
 return execFileSync("gh",args,{
  encoding:"utf8",timeout:120000,maxBuffer:8*1024*1024,
  env:{...process.env,GH_PROMPT_DISABLED:"1",...options.env},
  cwd:options.cwd
 });
}
export function offlineVerifyArgs(subject,actualPath,expectedSha,bundle,root){
 if(![TT44_RECEIPT_PATH,TT44_SCREENSHOT_PATH].includes(subject))
  fail("OUT_OF_SCOPE_SUBJECT");
 if(!isHex(expectedSha,40))fail("EXPECTED_COMMIT_REQUIRED");
 if(!actualPath||!bundle||!root)fail("FILE_PATHS_REQUIRED");
 return [
  ...consumerVerificationArgs(subject,actualPath,expectedSha),
  "--bundle",bundle,"--custom-trusted-root",root
 ];
}
export function validatePortableManifest(input,commit,receiptBytes,imageBytes,bundle1,bundle2,rootBytes){
 if(!input||typeof input!=="object"||Array.isArray(input))fail("INVALID_MANIFEST");
 const expectedKeys=["schema","status","repository","signerWorkflow","expectedSourceCommit",
  "producerRunId","receiptSha256","screenshotSha256","receiptBundleSha256",
  "screenshotBundleSha256","trustedRootSha256","reportSigned","releaseAuthorized",
  "antiMDone","instructions"];
 if(Object.keys(input).sort().join("|")!==expectedKeys.sort().join("|"))
  fail("MANIFEST_SCHEMA_FIELDS");
 const expected={
  schema:"thinktank.tt47-portable-proof-manifest.v1",
  status:"PORTABLE_PROOF_PACKAGE_BUILT_WITH_GITHUB_CLI",
  repository:TT44_REPOSITORY,signerWorkflow:TT44_WORKFLOW,
  expectedSourceCommit:commit,receiptSha256:sha256(receiptBytes),
  screenshotSha256:sha256(imageBytes),
  receiptBundleSha256:sha256(bundle1),screenshotBundleSha256:sha256(bundle2),
  trustedRootSha256:sha256(rootBytes),
  reportSigned:false,releaseAuthorized:false,antiMDone:false,
  instructions:"Independently supply the trusted main commit SHA; verify original bytes with GitHub CLI and trusted Sigstore roots."
 };
 for(const [key,value] of Object.entries(expected)){
  if(input[key]!==value)fail("MANIFEST_"+key);
 }
 if(!Number.isSafeInteger(input.producerRunId)||input.producerRunId<=0)
  fail("INVALID_PRODUCER_RUN_ID");
 return true;
}
async function readExact(root,name,max){
 const path=resolve(root,name),rel=relative(root,path);
 if(rel.startsWith("..")||isAbsolute(rel)||rel!==name)fail("ESCAPING_PATH");
 const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink())fail("NOT_REGULAR_FILE");
 if(st.size<1||st.size>max)fail("FILE_SIZE_"+name);
 return readFile(path);
}
export async function verifyPortableProof(folder,expectedCommit,{offline=true}={}){
 if(!isHex(expectedCommit,40))fail("EXPECTED_COMMIT_REQUIRED");
 const root=resolve(folder);
 const entries=(await readdir(root)).sort();
 const expected=Object.values(TT47_FILES).sort();
 if(JSON.stringify(entries)!==JSON.stringify(expected))fail("UNEXPECTED_PACKAGE_FILES");
 const files={};
 for(const [kind,name] of Object.entries(TT47_FILES))
  files[kind]=await readExact(root,name,maxSizes[kind]);
 const bound=validateConsumerArtifactFiles(
  files.receipt,files.screenshot,expectedCommit);
 const manifest=JSON.parse(files.manifest.toString("utf8"));
 validatePortableManifest(manifest,expectedCommit,files.receipt,files.screenshot,
  files.receiptBundle,files.screenshotBundle,files.trustedRoot);
 const scopes=[
  {subject:TT44_RECEIPT_PATH,file:TT47_FILES.receipt,bundle:TT47_FILES.receiptBundle},
  {subject:TT44_SCREENSHOT_PATH,file:TT47_FILES.screenshot,bundle:TT47_FILES.screenshotBundle}
 ];
 // TT-50: each downloaded JSONL can contain several unrelated/older
 // attestations. Check the actual byte digest in its signed DSSE subject
 // before invoking GitHub CLI, and pass only matching original signed
 // statements to the cryptographic verifier.
 const scopeDir=await mkdtemp(join(tmpdir(),"tt50-exact-subject-"));
 try{
  for(const [idx,item] of scopes.entries()){
   const kind=idx===0?"receipt":"screenshot";
   const bundleKind=idx===0?"receiptBundle":"screenshotBundle";
   const selected=subjectScopedAttestationBundle(
    files[bundleKind],item.subject,files[kind]);
   const scoped=join(scopeDir,"signed-subject-"+idx+".jsonl");
   await writeFile(scoped,selected.scopedJsonlBytes);
   const args=offlineVerifyArgs(item.subject,join(root,item.file),expectedCommit,
    scoped,join(root,TT47_FILES.trustedRoot));
   // Even after digest matching, only gh CLI validates the certificate,
   // signing workflow, source commit, signature and trusted roots.
   const raw=gh(args,{env:offline?{GH_TOKEN:"",GITHUB_TOKEN:""}:{}});
   requireGitHubVerifiedOutput(raw);
  }
 }finally{
  await rm(scopeDir,{recursive:true,force:true});
 }
 return {
  schema:"thinktank.tt47-portable-verification-result.v1",
  status:"BOTH_ORIGINAL_SUBJECTS_VERIFIED_USING_LOCAL_BUNDLES_AND_TRUST_ROOT",
  expectedCommit,receiptSha256:bound.receiptSha256,
  screenshotSha256:bound.screenshotSha256,verifiedSubjects:2,
  bundleRootMode:true,
  note:"Offline-capable local bundle verification; an online CI job does not prove physical network isolation.",
  evidenceVerifiedScope:"Exact first-party fixture subjects and GitHub workflow origin only",
  resultSigned:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false
 };
}
async function downloadBundle(inputFile,working){
 await mkdir(working,{recursive:true});
 gh(["attestation","download",inputFile,"--repo",TT44_REPOSITORY],{cwd:working});
 const names=(await readdir(working)).filter(x=>/^sha256:[a-f0-9]{64}\.jsonl$/.test(x));
 if(names.length!==1)fail("BUNDLE_MISSING_OR_AMBIGUOUS");
 return readFile(join(working,names[0]));
}
export async function createPortableProof({
 producerRunId,expectedCommit,receiptBytes,imageBytes,receiptPath,imagePath
}){
 if(!Number.isSafeInteger(producerRunId)||producerRunId<1)fail("INVALID_RUN_ID");
 if(!isHex(expectedCommit,40))fail("EXPECTED_COMMIT_REQUIRED");
 if(!receiptPath||!imagePath)fail("SUBJECT_PATHS_REQUIRED");
 validateConsumerArtifactFiles(receiptBytes,imageBytes,expectedCommit);
 const temp=await mkdtemp(join(tmpdir(),"tt47-bundle-"));
 try{
  const [receiptBundle,screenshotBundle]=await Promise.all([
   downloadBundle(receiptPath,join(temp,"receipt")),
   downloadBundle(imagePath,join(temp,"screenshot"))
  ]);
  const trustedRoot=Buffer.from(gh(["attestation","trusted-root"]),"utf8");
  if(trustedRoot.length===0||trustedRoot.length>maxSizes.trustedRoot)
   fail("TRUST_ROOT_SIZE_REFUSED");
  const content={
   receipt:Buffer.from(receiptBytes),screenshot:Buffer.from(imageBytes),
   receiptBundle,screenshotBundle,trustedRoot
  };
  const manifest={
   schema:"thinktank.tt47-portable-proof-manifest.v1",
   status:"PORTABLE_PROOF_PACKAGE_BUILT_WITH_GITHUB_CLI",
   repository:TT44_REPOSITORY,signerWorkflow:TT44_WORKFLOW,
   expectedSourceCommit:expectedCommit,producerRunId,
   receiptSha256:sha256(content.receipt),
   screenshotSha256:sha256(content.screenshot),
   receiptBundleSha256:sha256(content.receiptBundle),
   screenshotBundleSha256:sha256(content.screenshotBundle),
   trustedRootSha256:sha256(content.trustedRoot),
   reportSigned:false,releaseAuthorized:false,antiMDone:false,
   instructions:"Independently supply the trusted main commit SHA; verify original bytes with GitHub CLI and trusted Sigstore roots."
  };
  content.manifest=Buffer.from(JSON.stringify(manifest,null,2)+"\n");
  await mkdir(TT47_DIR,{recursive:true});
  for(const [kind,bytes] of Object.entries(content))
   await writeFile(join(TT47_DIR,TT47_FILES[kind]),bytes);
  const verified=await verifyPortableProof(TT47_DIR,expectedCommit);
  console.log("TT47_PORTABLE_BUNDLE_PASS",JSON.stringify({
   producerRunId,expectedCommit,verifiedSubjects:verified.verifiedSubjects,
   localBundleVerification:true,canonicalEvidence:false,antiMDone:false
  }));
  return verified;
 }finally{
  await rm(temp,{recursive:true,force:true});
 }
}
