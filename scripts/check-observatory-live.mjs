/* TT-41: real Chromium UI assertions on our own ThinkTank production preview.
 * The snapshot values below are test fixtures. This is NOT a third-party
 * application inspection, source attestation, nor an Anti-M release receipt.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {join} from "node:path";

const sha256=data=>createHash("sha256").update(data).digest("hex");
const fixtureName="TT-41 Owned Observatory Browser Fixture";
const checked=[
 "owned_study_created_in_real_chromium",
 "manual_trace_recorded_in_real_chromium",
 "capture_template_downloaded_and_schema_checked",
 "baseline_and_candidate_loaded_by_file_picker",
 "comparison_categories_asserted_in_rendered_UI",
 "expectation_agreements_disagreements_and_missing_asserted",
 "export_recomputed_from_candidate_and_verified_in_browser"
];

async function downloadJson(page,button){
 const [download]=await Promise.all([page.waitForEvent("download"),button.click()]);
 return JSON.parse(await readFile(await download.path(),"utf8"));
}

export async function assertOwnedObservatoryWorkflow(page){
 const lab=page.locator('[aria-label="Software behavior lab"]');
 await lab.waitFor({state:"visible"});
 assert.match(await lab.innerText(),/SOFTWARE BEHAVIOR LAB/);

 await lab.getByLabel("TARGET / APP NAME").fill(fixtureName);
 await lab.getByLabel("ACCESS BASIS · OPERATOR ASSERTION ONLY").selectOption("owned");
 await lab.getByLabel("IN-SCOPE BEHAVIOR").fill(
  "Real Chromium acceptance check of the first-party Observatory capture workflow.");
 await lab.getByLabel("SCOPE / PERMISSION NOTE").fill(
  "This repository and its generated browser test fixtures are owned for this local test.");
 await lab.getByRole("button",{name:"CREATE LOCAL STUDY"}).click();
 await lab.getByText("Study saved locally.",{exact:false}).waitFor();

 await lab.getByLabel("BEFORE · What was the visible state?").fill(
  "Fixture begins with a visible day mode and count seven.");
 await lab.getByLabel("ACTION · What did the operator do?").fill(
  "Simulate a local UI mode change using our own data fixture.");
 await lab.getByLabel("AFTER · What outcome was reported?").fill(
  "The fixture candidate displays night mode with count seven.");
 await lab.getByLabel("INTERPRET · What might explain the result?").fill(
  "Only the selected fixture values have changed.");
 await lab.getByLabel("INVENT · What is our independent design?").fill(
  "Use a first-party deterministic state representation.");
 await lab.getByLabel("TEST · What would we independently check?").fill(
  "Verify UI input validation, compare results, and exported authority flags.");
 await lab.getByRole("button",{name:"RECORD TRACE (NO RUN)"}).click();
 await lab.getByText("Manual trace recorded",{exact:false}).waitFor();

 await lab.locator(".capture-trace-select select").selectOption({index:1});
 const cap=lab.locator('[aria-label="Read-only capture comparison"]');
 const original=await downloadJson(page,cap.getByRole("button",{
  name:"DOWNLOAD JSON CAPTURE TEMPLATE"
 }));
 assert.equal(original.schema,"thinktank.behavior-capture.v1");
 assert.equal(original.executionAuthority,false);
 assert.equal(original.sourceVerified,false);
 assert.equal(original.testExecuted,false);
 assert.equal(original.target,fixtureName);

 const baseline={...original,observations:[
  {key:"ui.mode",value:"day"},{key:"ui.count",value:"7"},
  {key:"ui.old",value:"legacy"}
 ]};
 const candidate={...original,observations:[
  {key:"ui.mode",value:"night"},{key:"ui.count",value:"7"},
  {key:"ui.new",value:"modern"}
 ]};
 const baselineRaw=JSON.stringify(baseline,null,2);
 const candidateRaw=JSON.stringify(candidate,null,2);
 const picks=cap.locator('.capture-inputs input[type="file"]');
 await picks.nth(0).setInputFiles({
  name:"tt41-baseline.json",mimeType:"application/json",buffer:Buffer.from(baselineRaw)
 });
 await cap.getByText("BASELINE FILE LOADED LOCALLY",{exact:false}).waitFor();
 await picks.nth(1).setInputFiles({
  name:"tt41-candidate.json",mimeType:"application/json",buffer:Buffer.from(candidateRaw)
 });
 await cap.getByText("CANDIDATE FILE LOADED LOCALLY",{exact:false}).waitFor();
 const summary=cap.locator(".capture-summary").first();
 await summary.waitFor({state:"visible"});
 assert.match(await summary.innerText(),/UNCHANGED 1 · CHANGED 1 · ADDED 1 · MISSING 1/);

 const comparison=await downloadJson(page,cap.getByRole("button",{
  name:"EXPORT REVIEW-ONLY COMPARISON"
 }));
 assert.equal(comparison.status,"REVIEW_ONLY_NOT_A_TEST");
 assert.equal(comparison.evidenceVerified,false);
 assert.equal(comparison.testsPassed,false);
 assert.equal(comparison.executionAuthority,false);
 assert.equal(comparison.baselineSha256,sha256(baselineRaw));
 assert.equal(comparison.candidateSha256,sha256(candidateRaw));
 assert.deepEqual(comparison.counts,{unchanged:1,changed:1,added:1,missing:1});

 const pane=cap.locator('[aria-label="Capture-only expectation review"]');
 await pane.waitFor({state:"visible"});
 const addRule=async(key,operator,expected)=>{
  await pane.getByLabel("OBSERVATION KEY").fill(key);
  await pane.getByLabel("OPERATOR").selectOption(operator);
  if(expected!==null)await pane.getByLabel("EXPECTED STRING").fill(expected);
  await pane.getByRole("button",{name:/ADD RULE/}).click();
  await pane.getByText("Rule added to this browser session only",{exact:false}).waitFor();
 };
 await addRule("ui.mode","equals","night");
 await addRule("ui.count","differs","10");
 await addRule("ui.legacy","absent",null);
 await addRule("ui.new","present",null);
 await addRule("ui.missing","equals","undisclosed");
 await addRule("ui.mode","equals","day");

 const ruleSummary=pane.locator(".capture-summary");
 assert.match(await ruleSummary.innerText(),
  /AGREES 4 · CONTRADICTS 1 · NOT CAPTURED 1/);
 const report=await downloadJson(page,pane.getByRole("button",{
  name:"EXPORT REVIEW-ONLY RULE REPORT"
 }));
 assert.equal(report.schema,"thinktank.capture-expectations-report.v1");
 assert.deepEqual(report.evaluation.counts,{agrees:4,contradicts:1,notCaptured:1});
 assert.deepEqual(report.evaluation.results.map(x=>x.status),[
  "AGREES_WITH_RULE","AGREES_WITH_RULE","AGREES_WITH_RULE",
  "AGREES_WITH_RULE","NOT_CAPTURED","CONTRADICTS_RULE"
 ]);
 assert.equal(report.candidateSha256,sha256(candidateRaw));
 assert.equal(report.testsPassed,false);
 assert.equal(report.evidenceVerified,false);
 assert.equal(report.executionAuthority,false);
 assert.equal(report.evaluation.targetExecuted,false);
 assert.equal(report.evaluation.status,"CAPTURE_ONLY_NOT_AN_APPLICATION_TEST");
 assert.match(report.warning,/NOT an application/);

 return {
  checked,
  fixture:{target:fixtureName,baselineSha256:sha256(baselineRaw),
   candidateSha256:sha256(candidateRaw),
   expectedComparison:{unchanged:1,changed:1,added:1,missing:1},
   observedComparison:comparison.counts,
   expectedRules:{agrees:4,contradicts:1,notCaptured:1},
   observedRules:report.evaluation.counts},
  studiesAreOperatorNotes:true,captureValuesAreSynthetic:true
 };
}

function checkedOutSha(){
 try{return execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()}
 catch{return "unavailable"}
}

export async function writeOwnedObservatoryReceipt(page,run){
 const folder=join("artifacts","observatory");
 await mkdir(folder,{recursive:true});
 const screenshot=await page.screenshot({fullPage:false});
 await writeFile(join(folder,"tt41-owned-ui.png"),screenshot);
 const receipt={
  schema:"thinktank.observatory-live-browser-receipt.v1",
  scope:"FIRST_PARTY_THINKTANK_UI_FIXTURE_ONLY",
  executionType:"REAL_CHROMIUM_RENDERED_REACT_PREVIEW",
  outcome:"TEST_ASSERTIONS_PASSED",
  verifiedScope:"Only the named browser assertions against this checked-out build",
  browserTested:true,externalTargetTested:false,
  actualAppTested:"think-tank-production-preview",
  testedPath:"/think-tank/",
  checkedOutCommit:checkedOutSha(),
  runAt:new Date().toISOString(),
  testAssertions:run.checked,
  fixture:run.fixture,
  screenshot:{filename:"tt41-owned-ui.png",sha256:sha256(screenshot)},
  machineArtifact:true,cryptographicallySigned:false,
  note:"CI fixture execution demonstrates only this owned UI workflow. User-authored captures remain unverified.",
  canonicalEvidence:false,releaseAuthorized:false,antiMDone:false
 };
 const json=JSON.stringify(receipt,null,2)+"\n";
 await writeFile(join(folder,"tt41-owned-ui-receipt.json"),json);
 console.log("THINKTANK_OWNED_OBSERVATORY_UI_PASS",JSON.stringify({
  checked:run.checked.length,scope:receipt.scope,
  screenshotSha256:receipt.screenshot.sha256,
  releaseAuthorized:false,antiMDone:false
 }));
 return receipt;
}
