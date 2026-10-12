import {describe,it,expect} from "vitest";
import {buildOperatorCommand,parseOperatorInputs} from "./provenanceOperatorGuide";
const sha="a".repeat(40),root="b".repeat(64);
describe("TT51 operator guide does not become a signature verifier",()=>{
 it("produces exact local verifier commands for Windows and Unix with no authority",()=>{
  const pwsh=buildOperatorCommand(sha,root,"38204692731","powershell");
  expect(pwsh.command).toBe("node scripts/verify-tt51-operator-proof.mjs .\\unpacked-proof "+sha+" "+root);
  expect(pwsh.runUrl).toBe("https://github.com/MichaelWave369/think-tank/actions/runs/38204692731");
  expect(pwsh.proofArtifact).toBe("tt47-portable-offline-verification-proof");
  expect(pwsh.status).toBe("COMMAND_ONLY_SIGNATURES_NOT_VERIFIED_IN_BROWSER");
  expect(pwsh.releaseAuthorized).toBe(false);
  expect(pwsh.antiMDone).toBe(false);
  expect(buildOperatorCommand(sha,root,"","bash").command)
   .toContain("./unpacked-proof "+sha);
 });
 it("refuses misleading copy/pasted manifest fields, arbitrary shell paths and URLs",()=>{
  for(const [commit,shaRoot,run] of [
   ["INFERRED",root,""],[sha.toUpperCase(),root,""],[sha,"untrusted",""],
   [sha,root,"https://example.invalid"],[sha,root,"0"],
   [sha+";evil",root,""],[sha,root,"12;exit"],[sha,root,"999999999999999999"]
  ]){
   expect(()=>parseOperatorInputs(commit,shaRoot,run)).toThrow();
  }
  expect(()=>buildOperatorCommand(sha,root,"","cmd" as never)).toThrow(/UNSUPPORTED_SHELL/);
 });
 it("does not imply a run ID proves authenticity",()=>{
  const c=buildOperatorCommand(sha,root,"12345","bash");
  expect(c.operatorRunRequired).toBe(true);
  expect(c.command).not.toContain("12345");
  expect(c.releaseAuthorized).toBe(false);
 });
});
