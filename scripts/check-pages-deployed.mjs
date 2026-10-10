/* Postdeployment REAL public GitHub Pages Chromium acceptance.
 * Verifies the deployed commit and runtime. No local AI provider is contacted.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const site="https://michaelwave369.github.io/think-tank/";
const expectedSha=process.env.EXPECTED_SHA;
const expectedRun=process.env.EXPECTED_RUN_ID;
assert.match(expectedSha||"",/^[0-9a-f]{40}$/);
assert.match(expectedRun||"",/^[1-9][0-9]{0,18}$/);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let provenance;
for(let attempt=0;attempt<12;attempt++){
 try{
  const result=await fetch(site+"deploy-provenance.json",{
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10000)
  });
  assert.equal(result.status,200);
  provenance=await result.json();
  assert.equal(provenance.schema,"phi-thinktank.pages-deploy-provenance.v0.1");
  assert.equal(provenance.repository,"MichaelWave369/think-tank");
  assert.equal(provenance.sourceSha,expectedSha);
  assert.equal(provenance.deploymentWorkflowRunId,expectedRun);
  assert.equal(provenance.assetBase,"/think-tank/");
  assert.equal(provenance.browserVerified,false);
  assert.equal(provenance.modelExecutionAuthorized,false);
  assert.equal(provenance.independentExternalDone,false);
  break;
 }catch(error){
  if(attempt===11)throw Error("PUBLIC_PAGES_PROVENANCE_NOT_CURRENT: "+String(error));
  await sleep(5000);
 }
}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1376,height:900}});
 const localRequests=[],mutatingRequests=[],javascriptErrors=[],failedAssets=[];
 page.on("request",request=>{
  if(/^http:\/\/(?:127\.0\.0\.1|localhost):3691\b/.test(request.url()))localRequests.push(request.url());
  if(!["GET","HEAD","OPTIONS"].includes(request.method()))mutatingRequests.push(request.method()+" "+request.url());
 });
 page.on("pageerror",e=>javascriptErrors.push(String(e)));
 page.on("response",response=>{
  const url=response.url();
  if(url.startsWith(site+"assets/")&&response.status()>=400)
   failedAssets.push(response.status()+" "+url);
 });
 await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):3691\b/,route=>route.abort("blockedbyclient"));
 const response=await page.goto(site,{waitUntil:"networkidle",timeout:45000});
 assert.equal(response?.status(),200,"Public site must return 200");
 await page.locator(".room-header strong").waitFor({state:"visible",timeout:15000});
 const text=(await page.locator(".room-header strong").textContent())?.trim();
 assert.equal(text,"Φ THINK TANK");
 await page.locator('[aria-label="Public ThinkTank static site"]').waitFor({state:"visible"});
 const banner=await page.locator('[aria-label="Public ThinkTank static site"]').innerText();
 assert.ok(banner.includes("STATIC GITHUB PAGES"));
 assert.ok(banner.includes("No local bridge is contacted automatically"));
 await page.locator(".operator-rail textarea").waitFor({state:"visible"});
 await page.locator(".ledger-roll").waitFor({state:"visible"});
 await sleep(1500); // Catch startup useEffects attempting unauthorized localhost probes.
 assert.deepEqual(localRequests,[],"Visiting public site must NOT probe local AI or research bridge");
 assert.deepEqual(mutatingRequests,[],"Visiting public site must NOT issue write requests");
 assert.deepEqual(javascriptErrors,[],"Public site must not produce client runtime exceptions");
 assert.deepEqual(failedAssets,[],"Public React compiled assets must all exist");
 const assets=await page.evaluate(()=>[
  ...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')
 ].map(el=>el.getAttribute("src")||el.getAttribute("href")).filter(Boolean));
 assert.ok(assets.length>=2,"Expected published runtime JS and CSS");
 assert.ok(assets.every(p=>p.startsWith("/think-tank/assets/")),
  "Compiled scripts/stylesheets must use ThinkTank repo Pages subpath");
 console.log("PUBLIC_PAGES_BROWSER_SMOKE_PASS",JSON.stringify({
  url:site,sha:expectedSha,deploymentWorkflowRunId:expectedRun,
  title:text,assets:assets.length,localRequests:0,mutatingRequests:0,jsErrors:0,
  actualLiveModelsRun:false,independentExternalDone:false
 }));
}finally{await browser.close()}
