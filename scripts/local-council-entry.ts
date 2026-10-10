/* Explicit terminal-only local council runner.
 * No HTTP listener, browser tokens, remote providers or auto-execution.
 */
import {createHash,randomBytes} from "node:crypto";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {inspectLocalCouncilContract,runLocalGovernedCouncil,localCouncilDossierExport} from "../src/localCouncil";
import {modeDefinition} from "../src/domain/modes";

const BRIDGE="http://127.0.0.1:3691";
const die=(s:string):never=>{throw Error("LOCAL_COUNCIL_CLI_"+s)};
function load(path:string){
 const buf=readFileSync(resolve(path));
 if(buf.byteLength>8192)return die("CONTRACT_OVERSIZE");
 let input:unknown;
 try{input=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buf))}
 catch{return die("CONTRACT_JSON")}
 const contract=inspectLocalCouncilContract(input);
 return {contract,sha:createHash("sha256").update(buf).digest("hex")}
}
async function requireLocalModel(model:string,signal:AbortSignal){
 const r=await fetch(BRIDGE+"/providers/status",{method:"GET",signal,
  redirect:"error",headers:{accept:"application/json"}});
 if(!r.ok)die("PROVIDER_STATUS_HTTP_"+r.status);
 const status=await r.json() as {ok?:boolean;seats?:{seatId:string;state:string;models?:string[]}[]};
 const local=status?.seats?.find(x=>x.seatId==="local");
 if(status.ok!==true||local?.state!=="connected"||
    !Array.isArray(local.models)||!local.models.includes(model))
  die("LOCAL_MODEL_UNAVAILABLE");
}
async function invokeLocal(req:Parameters<Parameters<typeof runLocalGovernedCouncil>[1]>[0],signal?:AbortSignal){
 const r=await fetch(BRIDGE+"/providers/invoke",{
  method:"POST",signal,redirect:"error",
  headers:{"content-type":"application/json"},
  body:JSON.stringify(req)
 });
 if(!r.ok)die("PROVIDER_INVOKE_HTTP_"+r.status);
 const body=await r.json();
 return body as Awaited<ReturnType<Parameters<typeof runLocalGovernedCouncil>[1]>>
}
function output(receipt:Awaited<ReturnType<typeof runLocalGovernedCouncil>>,sha:string){
 const folder=resolve("local-council-artifacts");
 mkdirSync(folder,{recursive:true,mode:0o700});
 const id=new Date().toISOString().replace(/[:.]/g,"-")+"-"+randomBytes(4).toString("hex");
 const base=folder+"/council-"+id;
 const audit={schema:"phi-thinktank-local-council-result.v0.1",
  contractSha256:sha,summary:receipt.result,authority:receipt.authority,
  replay:receipt.replay,events:receipt.events};
 writeFileSync(base+"-ledger.json",JSON.stringify(audit,null,2)+"\n",{flag:"wx",mode:0o600});
 if(receipt.dossier){
  writeFileSync(base+"-decision-dossier.json",
   JSON.stringify(localCouncilDossierExport(receipt.dossier),null,2)+"\n",
   {flag:"wx",mode:0o600});
 }
 console.log("LOCAL_COUNCIL_LEDGER="+base+"-ledger.json");
 console.log("LOCAL_COUNCIL_DOSSIER="+(receipt.dossier?base+"-decision-dossier.json":"NOT_PRODUCED"));
}
async function main(argv:string[]){
 const [op,path,...rest]=argv;
 if(!["inspect","run"].includes(op||"")||!path)die("USAGE_inspect_OR_run_CONTRACT_JSON");
 const {contract,sha}=load(path);
 if(op==="inspect"){
  if(rest.length)die("INSPECT_HAS_NO_RUN_FLAGS");
  console.log(JSON.stringify({schema:contract.schema,sha256:sha,
   mode:contract.mode,roleTurns:modeDefinition(contract.mode).speakerQueue,
   model:contract.model,maxSessionSeconds:contract.maxSessionSeconds,
   provider:"ollama-local-only",approvalNeeded:true,
   executionTriggered:false,independentDone:false},null,2));
  return
 }
 if(rest.length!==2||rest[0]!=="--approve-sha256="+sha||
    rest[1]!=="--confirm-local-model-inference")die("EXPLICIT_SHA_APPROVAL_REQUIRED");
 // Node process itself is the human authorization boundary; this SHA is
 // a consent-to-these-exact-bytes check, NOT an authentication signature.
 const ctl=new AbortController();
 const timer=setTimeout(()=>ctl.abort(),contract.maxSessionSeconds*1000);
 const handleSigint=()=>ctl.abort();
 process.once("SIGINT",handleSigint);
 try{
  await requireLocalModel(contract.model,ctl.signal);
  const result=await runLocalGovernedCouncil(contract,invokeLocal,ctl.signal);
  output(result,sha);
  console.log(JSON.stringify({completed:result.result.completed,
   aborted:result.result.aborted,
   outputLabel:result.dossier?.outputLabel??"NO_DOSSIER",
   outcome:result.dossier?.outcome??"NOT_REACHED",
   source:result.dossier?.executionSource??"NO_DOSSIER",
   replayExact:result.replay.exact,
   note:"LIVE provider output is NOT factual truth, authenticated work approval or external DONE."}));
  if(!result.result.completed)process.exitCode=2
 }finally{
  clearTimeout(timer);
  process.removeListener("SIGINT",handleSigint)
 }
}
main(process.argv.slice(2)).catch(e=>{
 console.error(e instanceof Error?e.message:String(e));
 process.exitCode=1
});
