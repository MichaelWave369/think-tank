/* Tests the actual bundled terminal executable with a synthetic loopback
 * Ollama bridge. NO real Ollama model or remote API is invoked.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,unlinkSync} from "node:fs";
import {resolve} from "node:path";
import {once} from "node:events";

const fixture=resolve("tests/fixtures/local-council.sample.json");
const cli=resolve(".generated-local-council/local-council-entry.js");
const sha=createHash("sha256").update(readFileSync(fixture)).digest("hex");
const cliCall=args=>new Promise((resolveResult,reject)=>{
 const child=spawn(process.execPath,[cli,...args],{
  cwd:process.cwd(),
  env:{...process.env,OPENAI_API_KEY:"",KIMI_API_KEY:""},
  stdio:["ignore","pipe","pipe"]
 });
 let stdout="",stderr="";
 child.stdout.setEncoding("utf8");
 child.stderr.setEncoding("utf8");
 child.stdout.on("data",chunk=>stdout+=chunk);
 child.stderr.on("data",chunk=>stderr+=chunk);
 child.on("error",reject);
 child.on("close",code=>resolveResult({code,stdout,stderr}))
});
test("actual terminal runner refuses wrong SHA and produces replayed local-only dossier from mock bridge",async()=>{
 const invocations=[];
 const server=http.createServer(async(req,res)=>{
  let body="";
  for await(const chunk of req){body+=chunk.toString()}
  const send=(status,value)=>{
   res.writeHead(status,{"content-type":"application/json"});
   res.end(JSON.stringify(value))
  };
  if(req.method==="GET"&&req.url==="/providers/status"){
   return send(200,{ok:true,bridgeVersion:"0.15.0",
    seats:[{seatId:"local",state:"connected",models:["gemma3:12b"]}]});
  }
  if(req.method==="POST"&&req.url==="/providers/invoke"){
   const data=JSON.parse(body);
   invocations.push(data);
   assert.equal(data.seatId,"local");
   assert.equal(data.model,"gemma3:12b");
   assert.ok(["dreamer","builder","challenger","archivist","vessie"].includes(data.roleId));
   assert.ok(Array.isArray(data.messages));
   return send(200,{
    ok:true,seatId:"local",provider:"Ollama",model:"gemma3:12b",
    text:"SYNTHETIC LOOPBACK FIXTURE · This does not verify any real external claim.",
    latencyMs:1,requestId:"mock-"+invocations.length
   });
  }
  send(404,{ok:false,error:{code:"UNKNOWN_ENDPOINT"}})
 });
 const artifacts=[];
 try{
  server.listen(3691,"127.0.0.1");
  await once(server,"listening");
  const wrong=await cliCall(["run",fixture,"--approve-sha256="+"0".repeat(64),"--confirm-local-model-inference"]);
  assert.equal(wrong.code,1);
  assert.match(wrong.stderr,/EXPLICIT_SHA_APPROVAL_REQUIRED/);
  assert.equal(invocations.length,0);
  const run=await cliCall(["run",fixture,"--approve-sha256="+sha,"--confirm-local-model-inference"]);
  assert.equal(run.code,0,run.stdout+"\n"+run.stderr);
  assert.equal(invocations.length,5);
  assert.ok(invocations.every(x=>x.seatId==="local"&&x.model==="gemma3:12b"));
  const ledgerPath=run.stdout.match(/LOCAL_COUNCIL_LEDGER=(.*)/)?.[1]?.trim();
  const dossierPath=run.stdout.match(/LOCAL_COUNCIL_DOSSIER=(.*)/)?.[1]?.trim();
  assert.ok(ledgerPath&&dossierPath&&dossierPath!=="NOT_PRODUCED");
  artifacts.push(ledgerPath,dossierPath);
  const ledger=JSON.parse(readFileSync(ledgerPath,"utf8"));
  const dossierEnvelope=JSON.parse(readFileSync(dossierPath,"utf8"));
  assert.equal(ledger.contractSha256,sha);
  assert.equal(ledger.summary.turnsInvoked,5);
  assert.equal(ledger.summary.completed,true);
  assert.equal(ledger.replay.valid,true);
  assert.equal(ledger.replay.exact,true);
  assert.equal(ledger.authority.executionAuthorityGranted,false);
  assert.equal(ledger.authority.externalDoneAttested,false);
  assert.equal(dossierEnvelope.dossier.executionSource,"live-provider");
  assert.equal(dossierEnvelope.dossier.outcome,"withheld");
  assert.ok(dossierEnvelope.dossier.providerTurns.length>=1);
  assert.equal(dossierEnvelope.seals.length,0);
  assert.equal(dossierEnvelope.verifications.length,0);
  const verified=await cliCall(["verify",ledgerPath,dossierPath]);
  assert.equal(verified.code,0,verified.stdout+"\n"+verified.stderr);
  assert.equal(invocations.length,5,"verification must not invoke providers");
  const verificationPath=verified.stdout.match(/LOCAL_COUNCIL_VERIFICATION=(.*)/)?.[1]?.trim();
  assert.ok(verificationPath);
  artifacts.push(verificationPath);
  const receipt=JSON.parse(readFileSync(verificationPath,"utf8"));
  assert.equal(receipt.schema,"phi-thinktank-local-council-verification.v0.1");
  assert.equal(receipt.result,"KERNEL_REPLAY_PASS");
  assert.equal(receipt.ledgerSha256,createHash("sha256").update(readFileSync(ledgerPath)).digest("hex"));
  assert.equal(receipt.dossierSha256,createHash("sha256").update(readFileSync(dossierPath)).digest("hex"));
  assert.equal(receipt.dossierMatch,"EXACT");
  assert.equal(receipt.authGranted,false);
  assert.equal(receipt.truthAuthority,false);
  assert.equal(receipt.signerAuthenticated,false);

  const forgedPath=ledgerPath+".forged.json";
  artifacts.push(forgedPath);
  const forged={...ledger,events:ledger.events.map(e=>({...e}))};
  forged.events[0].stateBefore="fnv1a32:00000000";
  writeFileSync(forgedPath,JSON.stringify(forged));
  const denied=await cliCall(["verify",forgedPath,dossierPath]);
  assert.equal(denied.code,1,"tampered event fingerprint must fail kernel replay");
  assert.match(denied.stderr,/LOCAL_COUNCIL_VERIFY_KERNEL_/);
  assert.equal(invocations.length,5,"failed verifier also must not invoke providers");

 }finally{
  await new Promise(done=>server.close(done));
  for(const path of artifacts){try{unlinkSync(path)}catch{}}
 }
});
