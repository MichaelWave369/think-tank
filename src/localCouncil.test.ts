import {describe,it,expect} from "vitest";
import {
 inspectLocalCouncilContract,buildLocalCouncilInitialState,
 runLocalGovernedCouncil,localCouncilDossierExport
} from "./localCouncil";
import type {ProviderInvokeRequest} from "./providers/types";
import {replayEvents} from "./kernel/eventKernel";
import {createInitialState} from "./domain/state";
const contract=()=>({
 schema:"phi-thinktank-local-council.v0.1",
 mode:"council",directive:"Investigate this claim and explicitly challenge unsupported evidence.",
 provider:"ollama-local-only",model:"gemma3:12b",maxRoleTurns:5,maxSessionSeconds:180,
 allowRemoteProviders:false,browserAutoRun:false,
 executionAuthorityGranted:false,externalDoneAttested:false
});
describe("TT-35 SHA-approved local governed council contract",()=>{
 it("rejects all external-model or automatic-execution intent and unsupported budgets",()=>{
  const good=contract();
  expect(inspectLocalCouncilContract(good)).toEqual(good);
  for(const x of [
   {...good,allowRemoteProviders:true},
   {...good,browserAutoRun:true},
   {...good,executionAuthorityGranted:true},
   {...good,externalDoneAttested:true}
  ])expect(()=>inspectLocalCouncilContract(x)).toThrow(/LOCAL_COUNCIL_AUTHORITY/);
  expect(()=>inspectLocalCouncilContract({...good,model:"../../evil"})).toThrow(/MODEL/);
  expect(()=>inspectLocalCouncilContract({...good,mode:"free-run"})).toThrow(/MODE/);
  expect(()=>inspectLocalCouncilContract({...good,maxRoleTurns:6})).toThrow(/ROLE_BUDGET/);
  expect(()=>inspectLocalCouncilContract({...good,maxSessionSeconds:3600})).toThrow(/TIME_BUDGET/);
  expect(()=>inspectLocalCouncilContract({...good,endpoint:"https://api.example.com"})).toThrow(/FIELDS/);
 });
 it("writes every paid-seat disablement as a canonical replayable event",()=>{
  const initial=buildLocalCouncilInitialState(inspectLocalCouncilContract(contract()));
  expect(initial.seatStatus.openai).toBe("offline");
  expect(initial.seatStatus.kimi).toBe("offline");
  expect(initial.seatStatus.local).toBe("online");
  expect(initial.events.map(x=>x.kind)).toEqual(["seat.status","seat.status"]);
  expect(replayEvents(createInitialState(),initial.events).seatStatus).toEqual(initial.seatStatus);
 });
 it("executes real liveRunner and Crane Fly event kernel through local-only fake adapter, with no automatic trust promotion",async()=>{
  const calls:ProviderInvokeRequest[]=[];
  const result=await runLocalGovernedCouncil(contract(),async req=>{
   calls.push(req);
   return {ok:true,seatId:"local",provider:"Ollama",model:"gemma3:12b",
    text:"Fixture final provider response: no independent source evidence.",latencyMs:1}
  });
  expect(result.replay.valid).toBe(true);
  expect(result.replay.exact).toBe(true);
  expect(result.result.completed).toBe(true);
  expect(result.result.turnsInvoked).toBe(5);
  expect(calls).toHaveLength(5);
  expect(calls.every(x=>x.seatId==="local"&&x.model==="gemma3:12b")).toBe(true);
  expect(result.events.some(e=>e.source==="provider"&&e.kind==="challenge.raised")).toBe(true);
  expect(result.dossier?.executionSource).toBe("live-provider");
  expect(result.dossier?.outcome).toBe("withheld");
  expect(result.authority.executionAuthorityGranted).toBe(false);
  expect(result.authority.externalDoneAttested).toBe(false);
  expect(result.authority.independentEvidenceVerified).toBe(false);
  if(!result.dossier)throw Error("Expected governed dossier");
  const out=localCouncilDossierExport(result.dossier);
  expect(out.dossier.basisFingerprint).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
  expect(out.seals).toEqual([]);
  expect(out.verifications).toEqual([]);
 });
 it("rejects provider responses outside exact model/seat scope with a canonical faulted history",async()=>{
  const result=await runLocalGovernedCouncil(contract(),async req=>({
   ok:true,seatId:"openai",provider:"OpenAI",model:req.model||"bad",
   text:"Wrong seat",latencyMs:1
  }));
  expect(result.replay.exact).toBe(true);
  expect(result.result.completed).toBe(false);
  expect(result.events.some(e=>e.kind==="provider.failed")).toBe(true);
  expect(result.result.error).toMatch(/LOCAL_COUNCIL_PROVIDER_RESPONSE/);
 });
 it("pre-aborted calls produce no billable request and no fake completion",async()=>{
  const ctl=new AbortController();ctl.abort();
  let calls=0;
  const result=await runLocalGovernedCouncil(contract(),async()=>{
   calls++;throw Error("Never reached")
  },ctl.signal);
  expect(calls).toBe(0);
  expect(result.result.aborted).toBe(true);
  expect(result.replay.exact).toBe(true);
 });
});
