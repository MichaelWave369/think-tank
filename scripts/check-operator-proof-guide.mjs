/* TT-51: actual Chromium test of a read-only Windows/Unix operator guide.
 * No claims that this browser performs Sigstore cryptographic verification.
 */
import assert from "node:assert/strict";

export async function assertOperatorProofGuideInChromium(page){
 const guide=page.locator('[aria-label="TT-51 portable proof operator guide"]');
 await guide.locator("summary").click();
 const fields=guide.locator('input[type="text"]');
 assert.equal(await fields.count(),3);
 const prepare=guide.getByRole("button",{name:"PREPARE LOCAL COMMAND · NO EXECUTION"});
 await fields.nth(0).fill("TRUST ME BRO");
 await fields.nth(1).fill("b".repeat(64));
 await prepare.click();
 await guide.getByText("COMMAND REFUSED:",{exact:false}).waitFor({state:"visible"});
 assert.equal(await guide.locator(".tt51-operator-result").count(),0);

 const commit="a".repeat(40),root="b".repeat(64);
 await fields.nth(0).fill(commit);
 await fields.nth(1).fill(root);
 await fields.nth(2).fill("38204692731");
 await prepare.click();
 const result=guide.locator(".tt51-operator-result");
 await result.waitFor({state:"visible"});
 assert.match(await result.innerText(),/SIGNATURES NOT VERIFIED BY THIS BROWSER/);
 assert.equal(await result.locator("pre").innerText(),
  "node scripts/verify-tt51-operator-proof.mjs .\\unpacked-proof "+commit+" "+root);
 assert.equal(await result.locator("a").getAttribute("href"),
  "https://github.com/MichaelWave369/think-tank/actions/runs/38204692731");
 await guide.locator("select").selectOption("bash");
 assert.equal(await result.count(),0,"Changing shell retained stale prepared command");
 await prepare.click();
 assert.match(await result.locator("pre").innerText(),/\.\/unpacked-proof/);
 await fields.nth(2).fill("123;invalid");
 await prepare.click();
 await guide.getByText("COMMAND REFUSED:",{exact:false}).waitFor({state:"visible"});
 assert.equal(await result.count(),0);

 console.log("TT51_OPERATOR_PROOF_UI_PASS",JSON.stringify({
  windowsCommandBuilt:true,unixCommandBuilt:true,
  invalidTrustInputsRejected:true,runUrlConstrained:true,
  browserSignatureVerification:false,releaseAuthorized:false,antiMDone:false
 }));
}
