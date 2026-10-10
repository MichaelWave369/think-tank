/* TT-35: locally approved, local-model-only council contract.
 * Executes the SAME governed ThinkTank liveRunner/event kernel as browser
 * LIVE. This is NOT an HTTP council API and does NOT authorize external work.
 */
import {createInitialState} from "./domain/state";
import {seats} from "./data/terminals";
import {modeDefinition} from "./domain/modes";
import {buildEvent,verifyReplay} from "./kernel/eventKernel";
import {projectEvent} from "./domain/reducer";
import {runLiveProviderSession} from "./providers/liveRunner";
import type {CollaborationMode,ThinkTankState,ThinkTankEventInput} from "./domain/types";
import type {ProviderInvokeRequest,ProviderInvokeResponse} from "./providers/types";

export type LocalCouncilContract={
 schema:"phi-thinktank-local-council.v0.1";
 mode:"council"|"trio"|"audit";
 directive:string;
 provider:"ollama-local-only";
 model:string;
 maxRoleTurns:number;
 maxSessionSeconds:number;
 allowRemoteProviders:false;
 browserAutoRun:false;
 executionAuthorityGranted:false;
 externalDoneAttested:false;
};
const fields=[
 "schema","mode","directive","provider","model","maxRoleTurns",
 "maxSessionSeconds","allowRemoteProviders","browserAutoRun",
 "executionAuthorityGranted","externalDoneAttested"
];
const refused=(c:string):never=>{throw Error("LOCAL_COUNCIL_"+c)};
const plain=(x:unknown):x is Record<string,unknown>=>
 x!==null&&typeof x==="object"&&!Array.isArray(x);
export function inspectLocalCouncilContract(x:unknown):LocalCouncilContract{
 if(!plain(x)||Object.keys(x).sort().join("|")!==fields.slice().sort().join("|"))
  return refused("FIELDS");
 if(x.schema!=="phi-thinktank-local-council.v0.1"||
    x.provider!=="ollama-local-only")return refused("SCHEMA");
 if(!["council","trio","audit"].includes(String(x.mode)))return refused("MODE");
 if(typeof x.directive!=="string"||x.directive.trim().length<5||
    x.directive.length>1200||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x.directive))
  return refused("DIRECTIVE");
 if(typeof x.model!=="string"||x.model.length>90||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,89}$/.test(x.model)||
    x.model.includes(".."))return refused("MODEL");
 const roles=modeDefinition(x.mode as CollaborationMode).speakerQueue;
 if(!Number.isInteger(x.maxRoleTurns)||x.maxRoleTurns!==roles.length||roles.length>5)
  return refused("ROLE_BUDGET");
 if(typeof x.maxSessionSeconds!=="number"||!Number.isInteger(x.maxSessionSeconds)||
    x.maxSessionSeconds<30||x.maxSessionSeconds>600)return refused("TIME_BUDGET");
 if(x.allowRemoteProviders!==false||x.browserAutoRun!==false||
    x.executionAuthorityGranted!==false||x.externalDoneAttested!==false)
  return refused("AUTHORITY");
 return x as LocalCouncilContract
}
export function buildLocalCouncilInitialState(contract:LocalCouncilContract):ThinkTankState{
 inspectLocalCouncilContract(contract);
 let state=createInitialState();
 const append=(input:ThinkTankEventInput)=>{state=projectEvent(state,buildEvent(state,input))};
 // Record in the actual event ledger that both paid seats are offline.
 for(const seatId of ["openai","kimi"] as const){
  append({source:"operator",kind:"seat.status",phase:"routing",
   seatId,seatStatus:"offline",
   message:"Operator contract explicitly disables "+seatId.toUpperCase()+" paid seat."})
 }
 if(contract.mode!=="council"){
  append({source:"operator",kind:"mode.selected",mode:contract.mode,phase:"intake",
   message:"Operator contract selected "+contract.mode.toUpperCase()+" governed mode."})
 }
 return state
}
export async function runLocalGovernedCouncil(
  input:unknown,
  invoke:(request:ProviderInvokeRequest,signal?:AbortSignal)=>Promise<ProviderInvokeResponse>,
  signal?:AbortSignal
){
 const contract=inspectLocalCouncilContract(input);
 const initial=buildLocalCouncilInitialState(contract);
 const requests:ProviderInvokeRequest[]=[];
 const safeInvoke=async(req:ProviderInvokeRequest,localSignal?:AbortSignal)=>{
  if(req.seatId!=="local"||req.model!==contract.model||
      !["dreamer","builder","challenger","archivist","vessie"].includes(req.roleId))
    return refused("PROVIDER_SCOPE");
  if(requests.length>=contract.maxRoleTurns)return refused("ROLE_BUDGET");
  requests.push(req);
  const response=await invoke(req,localSignal);
  if(!response||response.ok!==true||response.seatId!=="local"||
      response.model!==contract.model||typeof response.text!=="string"||
      !response.text.trim()||response.text.length>20000)
    return refused("PROVIDER_RESPONSE");
  return response
 };
 const result=await runLiveProviderSession({
  initialState:initial,seats,prompt:contract.directive,
  localModel:contract.model,signal,invoke:safeInvoke,apply:()=>{}
 });
 const replay=verifyReplay(createInitialState(),result.state.events,result.state);
 if(!replay.valid||!replay.exact)return refused("LEDGER_REPLAY");
 if(requests.length>contract.maxRoleTurns)return refused("ROLE_BUDGET");
 const dossier=result.state.decisionDossiers.slice(-1)[0]??null;
 return {
  result:{completed:result.completed,aborted:result.aborted,error:result.error??null,
   turnsInvoked:requests.length,mode:contract.mode,model:contract.model},
  dossier,events:result.state.events,replay,
  authority:{executionAuthorityGranted:false,externalDoneAttested:false,
   independentEvidenceVerified:false,provider:"ollama-local-only"}
 }
}
export function localCouncilDossierExport(dossier:NonNullable<Awaited<ReturnType<typeof runLocalGovernedCouncil>>["dossier"]>){
 // Exact TEAR / EXPORT DOSSIER envelope consumed by SPV #77 importer.
 return {
  dossier,override:null,seals:[],verifications:[],transparencyEntries:[],
  transparencyCheckpoints:[],witnesses:[],witnessVerifications:[],
  rfc3161Timestamps:[],checkpointPublications:[],provenanceAssurances:[],
  releaseManifests:[],releaseSeals:[],releaseSealVerifications:[],
  releaseRfc3161Timestamps:[],releasePublications:[],releasePublicationAudits:[],
  releaseAvailabilityAssurances:[],publisherOriginIdentities:[]
 }
}
