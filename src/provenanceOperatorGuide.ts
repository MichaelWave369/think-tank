/* TT-51: browser-local command planner, NOT browser Sigstore verification.
 * Every input is strictly bounded. The user must independently obtain
 * expected commit and root SHA, not copy them from an editable manifest.
 */
export const TT51_TRUSTED_REPOSITORY="MichaelWave369/think-tank";
export const TT51_PROOF_ARTIFACT="tt47-portable-offline-verification-proof";
export type TT51Platform="powershell"|"bash";

export function parseOperatorInputs(sourceCommit:string,rootSha:string,runId:string){
 const commit=sourceCommit.trim();
 const root=rootSha.trim();
 const run=runId.trim();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error("REQUIRES_INDEPENDENT_40_CHAR_MAIN_COMMIT");
 if(!/^[a-f0-9]{64}$/.test(root))throw Error("REQUIRES_INDEPENDENT_64_CHAR_TRUST_ROOT");
 if(run!==""&&!/^[1-9][0-9]{0,15}$/.test(run))
  throw Error("OPTIONAL_GITHUB_RUN_ID_MUST_BE_DECIMAL");
 return {commit,root,run};
}
export function buildOperatorCommand(
 sourceCommit:string,rootSha:string,runId:string,platform:TT51Platform
){
 const parsed=parseOperatorInputs(sourceCommit,rootSha,runId);
 if(platform!=="powershell"&&platform!=="bash")throw Error("UNSUPPORTED_SHELL");
 const directory=platform==="powershell"?".\\unpacked-proof":"./unpacked-proof";
 return {
  command:"node scripts/verify-tt51-operator-proof.mjs "+directory+
   " "+parsed.commit+" "+parsed.root,
  runUrl:parsed.run===""?null:
   "https://github.com/"+TT51_TRUSTED_REPOSITORY+"/actions/runs/"+parsed.run,
  proofArtifact:TT51_PROOF_ARTIFACT,
  status:"COMMAND_ONLY_SIGNATURES_NOT_VERIFIED_IN_BROWSER" as const,
  operatorRunRequired:true as const,
  releaseAuthorized:false as const,
  antiMDone:false as const
 };
}
