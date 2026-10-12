/* TT-42: real DOM observations from a separate, checked-in owned fixture.
 * No user-selected URL, no generic remote automation and no bridge calls.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
import {
 OWNED_FIXTURE_PATH,validateOwnedProbeContract,compareObservedWithExpected
} from "./owned-browser-contract.mjs";

const sha256=bytes=>createHash("sha256").update(bytes).digest("hex");
const pathToContract="tests/fixtures/observatory-owned-counter.contract.json";
const outDir=join("artifacts","observatory");
const readSelectors=async(page,contract)=>{
 const observations=Object.create(null);
 for(const item of contract.observations){
  const node=page.getByTestId(item.testId);
  assert.equal(await node.count(),1,"Selector must resolve to exactly one owned-fixture element");
  const value=await node.textContent();
  assert.ok(typeof value==="string","Observed element must have text");
  observations[item.key]=value.trim();
 }
 return Object.fromEntries(Object.entries(observations));
};
const shaHead=()=>{
 try{return execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()}
 catch{return "UNAVAILABLE"}
};
function checkActual(actual,expected,keys,stage){
 const result=compareObservedWithExpected(actual,expected,keys);
 assert.equal(result.matches,true,stage+" did not match checked-in own-app contract: "+JSON.stringify(result.issues));
}

export async function runOwnedFixtureProbe(){
 // Scope is fixed in source and contract validation, not supplied by a user URL.
 const fixture=await readFile(OWNED_FIXTURE_PATH);
 const rawContract=await readFile(pathToContract);
 const contract=validateOwnedProbeContract(JSON.parse(rawContract.toString("utf8")));
 const externalRequests=[],unexpectedMethods=[],pageErrors=[];
 const server=createServer((req,res)=>{
  if(req.method!=="GET"||req.url!=="/owned-fixture/"){
   res.writeHead(404,{"Content-Type":"text/plain"});res.end("not found");return;
  }
  res.writeHead(200,{
   "Content-Type":"text/html; charset=utf-8",
   "Cache-Control":"no-store",
   "X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'"
  });
  res.end(fixture);
 });
 await new Promise((resolve,reject)=>{
  server.once("error",reject);
  server.listen(0,"127.0.0.1",resolve);
 });
 const port=server.address().port;
 const targetUrl="http://127.0.0.1:"+port+"/owned-fixture/";
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1100,height:760}});
  const page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror",err=>pageErrors.push(String(err)));
  await page.route("**/*",async route=>{
   const req=route.request();
   if(req.url()!==targetUrl||req.method()!=="GET"){
    externalRequests.push(req.method()+" "+req.url());
    await route.abort("blockedbyclient");
    return;
   }
   await route.continue();
  });
  page.on("request",req=>{
   if(!["GET","HEAD"].includes(req.method()))unexpectedMethods.push(req.method());
  });
  const keys=contract.observations.map(x=>x.key);
  const rounds=[];
  for(let round=0;round<2;round++){
   const response=await page.goto(targetUrl,{waitUntil:"load"});
   assert.equal(response?.status(),200);
   assert.equal(page.url(),targetUrl);
   const before=await readSelectors(page,contract);
   checkActual(before,contract.expectedBefore,keys,"BEFORE round "+round);
   await page.getByTestId(contract.action.testId).click();
   const after=await readSelectors(page,contract);
   checkActual(after,contract.expectedAfter,keys,"AFTER round "+round);
   rounds.push({round:round+1,before,after});
  }
  assert.deepEqual(rounds[0].before,rounds[1].before,"Reload was not deterministic");
  assert.deepEqual(rounds[0].after,rounds[1].after,"Transition was not deterministic");
  assert.deepEqual(externalRequests,[],"Owned fixture attempted an out-of-scope network request");
  assert.deepEqual(unexpectedMethods,[],"Owned fixture attempted a write request");
  assert.deepEqual(pageErrors,[],"Owned fixture emitted a JavaScript exception");
  const screenshot=await page.screenshot({fullPage:false});
  const receipt={
   schema:"thinktank.owned-app-browser-observation.v1",
   status:"OWNED_FIXTURE_ASSERTIONS_PASSED",
   scope:"EXACT_CHECKED_IN_LOCAL_FIXTURE_ONLY",
   target:contract.target,
   actualAppExercised:"independent-owned-html-counter-fixture",
   browserEngine:"chromium",browserVersion:browser.version(),
   checkedOutCommit:shaHead(),runAt:new Date().toISOString(),
   fixtureSourceSha256:sha256(fixture),
   checkedInContractSha256:sha256(rawContract),
   measuredBy:"REAL_HEADLESS_CHROMIUM_DOM_TEXT",
   rounds,
   assertions:{
    beforeMatchesContract:true,afterMatchesContract:true,
    deterministicReload:true,externalRequests:0,mutationRequests:0,pageExceptions:0
   },
   screenshot:{name:"tt42-owned-target.png",sha256:sha256(screenshot)},
   sourceValues:"MEASURED_FROM_OUR_RUNNING_FIXTURE_NOT_OPERATOR_ENTERED_JSON",
   separateFromTT39OperatorCaptureSchema:true,
   testExecutedOnOwnedFixture:true,thirdPartyAppTested:false,
   signed:false,canonicalEvidence:false,releaseAuthorized:false,antiMDone:false
  };
  await mkdir(outDir,{recursive:true});
  await writeFile(join(outDir,"tt42-owned-target.png"),screenshot);
  await writeFile(join(outDir,"tt42-owned-target-receipt.json"),
   JSON.stringify(receipt,null,2)+"\n");
  console.log("TT42_OWNED_TARGET_BROWSER_PASS",JSON.stringify({
   rounds:rounds.length,commit:receipt.checkedOutCommit,
   fixtureSourceSha256:receipt.fixtureSourceSha256,
   externalRequests:0,releaseAuthorized:false,antiMDone:false
  }));
  return receipt;
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(()=>resolve()));
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 await runOwnedFixtureProbe();
}
