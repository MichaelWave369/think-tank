/* Chromium release-candidate smoke against the ACTUAL /think-tank/ Vite
 * production preview. Does not install, start or invoke any local AI bridge.
 */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {chromium} from "playwright";

const site="http://127.0.0.1:4177/think-tank/";
// Spawn Vite directly: killing npm alone can leave an orphaned preview server.
const vite=resolve("node_modules/vite/bin/vite.js");
const child=spawn(process.execPath,[vite,"preview","--host","127.0.0.1",
 "--port","4177","--strictPort"],{stdio:["ignore","ignore","pipe"]});
let childErrors="";
child.stderr.on("data",c=>{childErrors+=c.toString().slice(0,3000)});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let browser;
try{
 let ready=false;
 for(let i=0;i<35;i++){
  if(child.exitCode!==null)throw Error("PREVIEW_SERVER_EXIT "+childErrors);
  try{
   const res=await fetch(site,{signal:AbortSignal.timeout(1400)});
   if(res.ok){ready=true;break}
  }catch{}
  await sleep(500);
 }
 assert.equal(ready,true,"Vite preview failed to serve /think-tank/: "+childErrors);
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1280,height:900}});
 const bridge=[],writes=[],exceptions=[],missing=[];
 page.on("request",r=>{
  if(/^http:\/\/(?:127\.0\.0\.1|localhost):3691\b/.test(r.url()))bridge.push(r.url());
  if(!["GET","HEAD","OPTIONS"].includes(r.method()))writes.push(r.method()+" "+r.url());
 });
 page.on("pageerror",error=>exceptions.push(String(error)));
 page.on("response",r=>{
  if(r.url().startsWith(site+"assets/")&&r.status()>=400)
   missing.push(r.status()+" "+r.url());
 });
 await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):3691\b/,
  route=>route.abort("blockedbyclient"));
 const response=await page.goto(site,{waitUntil:"networkidle"});
 assert.equal(response?.status(),200);
 await page.locator(".room-header strong").waitFor({state:"visible"});
 assert.equal((await page.locator(".room-header strong").innerText()).trim(),"Φ THINK TANK");
 await page.locator('[aria-label="Public ThinkTank static site"]').waitFor({state:"visible"});
 assert.match(await page.locator('[aria-label="Public ThinkTank static site"]').innerText(),
  /No local bridge is contacted automatically/);
 assert.deepEqual(bridge,[],"Public app mounted with an unexpected localhost connection");
 assert.deepEqual(writes,[],"Public app mounted with unexpected mutation request");
 const assets=await page.evaluate(()=>[
  ...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')
 ].map(el=>el.getAttribute("src")||el.getAttribute("href")).filter(Boolean));
 assert.ok(assets.length>=2);
 assert.ok(assets.every(x=>x.startsWith("/think-tank/assets/")));
 const prompt=page.locator(".operator-rail textarea");
 await prompt.fill("Test deterministic browser simulation; verify no provider is contacted.");
 const run=page.getByRole("button",{name:"RUN SIMULATION"});
 assert.equal(await run.isEnabled(),true,"Public simulation was unexpectedly disabled");
 await run.click();
 const exportButton=page.getByRole("button",{name:"TEAR / EXPORT DOSSIER"});
 await exportButton.waitFor({state:"visible",timeout:90000});
 const [download]=await Promise.all([
  page.waitForEvent("download"),
  exportButton.click()
 ]);
 const data=JSON.parse(await readFile(await download.path(),"utf8"));
 assert.equal(data.dossier.executionSource,"simulation-fixture");
 assert.equal(data.dossier.operatorPrompt,
  "Test deterministic browser simulation; verify no provider is contacted.");
 assert.match(data.dossier.basisFingerprint,/^fnv1a32:[0-9a-f]{8}$/);
 assert.deepEqual(bridge,[],"Simulation attempted a local AI bridge call");
 assert.deepEqual(writes,[],"Simulation issued external write traffic");
 assert.deepEqual(exceptions,[],"Public Vite preview produced a runtime exception");
 assert.deepEqual(missing,[],"Public Vite preview loaded a broken asset");
 console.log("THINKTANK_PUBLIC_REACT_PREVIEW_PASS",JSON.stringify({
  path:"/think-tank/",assets:assets.length,simulationSource:data.dossier.executionSource,
  downloadedDossier:data.dossier.id,automaticBridgeCalls:0,mutationRequests:0,
  browserExceptions:0,actualLiveModelCalled:false
 }));
}finally{
 if(browser)await browser.close();
 child.kill("SIGTERM");
 await sleep(500);
 if(child.exitCode===null)child.kill("SIGKILL");
}
