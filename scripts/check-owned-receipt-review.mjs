/* TT-43: ingest the TT-42 test's *real* CI artifact through the React file picker.
 * Passing asserts the viewer interpreted an uploaded file, not that the file
 * independently authenticates the test runner that created it.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

const digest=data=>createHash("sha256").update(data).digest("hex");

export async function assertOwnedReceiptReviewInChromium(page){
 const dir=join("artifacts","observatory");
 const raw=await readFile(join(dir,"tt42-owned-target-receipt.json"));
 const screenshot=await readFile(join(dir,"tt42-owned-target.png"));
 const original=JSON.parse(raw.toString("utf8"));
 assert.equal(original.status,"OWNED_FIXTURE_ASSERTIONS_PASSED");
 assert.equal(digest(screenshot),original.screenshot.sha256,
  "Independent screenshot digest precheck failed");

 const reviewer=page.locator('[aria-label="TT-43 machine receipt review"]');
 await reviewer.locator("summary").click();
 const picks=reviewer.locator('input[type="file"]');
 await picks.nth(0).setInputFiles({
  name:"tt42-owned-target-receipt.json",mimeType:"application/json",buffer:raw
 });
 await reviewer.locator(".owned-receipt-summary strong").waitFor({state:"visible"});
 assert.match(await reviewer.locator(".owned-receipt-summary").innerText(),
  /STRUCTURALLY CONSISTENT · NOT AUTHENTICATED/);
 assert.match(await reviewer.locator(".owned-receipt-summary").innerText(),
  new RegExp(digest(raw)));
 const rows=await reviewer.locator(".capture-table tbody tr").allInnerTexts();
 assert.equal(rows.length,2);
 assert.match(rows[0],/ui\.mode/);
 assert.match(rows[0],/day/);
 assert.match(rows[0],/night/);
 assert.match(rows[1],/ui\.count/);

 await picks.nth(1).setInputFiles({
  name:"tt42-owned-target.png",mimeType:"image/png",buffer:screenshot
 });
 await reviewer.getByText("SCREENSHOT SHA-256 MATCHES DECLARED BYTES",{exact:false})
  .waitFor({state:"visible"});
 const [reportFile]=await Promise.all([
  page.waitForEvent("download"),
  reviewer.getByRole("button",{name:"EXPORT UNAUTHENTICATED REVIEW"}).click()
 ]);
 const review=JSON.parse(await readFile(await reportFile.path(),"utf8"));
 assert.equal(review.schema,"thinktank.owned-receipt-review.v1");
 assert.equal(review.status,"STRUCTURALLY_CONSISTENT_UNAUTHENTICATED");
 assert.equal(review.scope,"TT42_FIXED_FIRST_PARTY_FIXTURE_ONLY");
 assert.equal(review.receiptSha256,digest(raw));
 assert.equal(review.checkedOutCommit,original.checkedOutCommit);
 assert.equal(review.screenshotDigestComparison,"MATCHES_DECLARED_BYTES");
 assert.deepEqual(review.before,{"ui.mode":"day","ui.count":"0"});
 assert.deepEqual(review.after,{"ui.mode":"night","ui.count":"1"});
 assert.equal(review.testExecutionAuthenticated,false);
 assert.equal(review.originAuthenticated,false);
 assert.equal(review.evidenceVerified,false);
 assert.equal(review.releaseAuthorized,false);
 assert.equal(review.antiMDone,false);

 const forged={...original,releaseAuthorized:true};
 await picks.nth(0).setInputFiles({
  name:"forged-tt42-receipt.json",mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify(forged))
 });
 await reviewer.getByText("RECEIPT REFUSED:",{exact:false}).waitFor({state:"visible"});
 assert.equal(await reviewer.getByRole("button",{
  name:"EXPORT UNAUTHENTICATED REVIEW"
 }).count(),0,"A rejected forged receipt still left export enabled");
 console.log("TT43_MACHINE_RECEIPT_REVIEW_PASS",JSON.stringify({
  checkedOutCommit:original.checkedOutCommit,
  receiptSha256:digest(raw),
  screenshotSha256:digest(screenshot),
  values:"ui.mode day->night, ui.count 0->1",
  forgedAuthorityDenied:true,
  originAuthenticated:false,releaseAuthorized:false
 }));
}
