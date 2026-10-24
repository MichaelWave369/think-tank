/* TT-35 R8: independent local read-only replay of a previously emitted
 * local council ledger. Uses the SAME event kernel as live execution.
 * No model calls, browser APIs, network requests, signatures or approvals.
 */
import {createInitialState} from "./domain/state";
import {replayEvents,verifyReplay} from "./kernel/eventKernel";
import {stableStringify} from "./kernel/stable";
import type {ThinkTankEvent,SynthesisDecisionDossier} from "./domain/types";

export const LOCAL_REPLAY_REPORT_SCHEMA="phi-thinktank-local-council-verification.v0.1";
const modes={council:5,trio:3,audit:2} as const;
type Mode=keyof typeof modes;
type Obj=Record<string,unknown>;
const fail=(reason:string):never=>{throw Error("LOCAL_COUNCIL_VERIFY_"+reason)};
const plain=(v:unknown):v is Obj=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const obj=(value:unknown,name:string):Obj=>{
 if(!plain(value))fail(name+"_OBJECT");
 return value as Obj
};
const bounded=(value:unknown,name:string,max:number)=>{
 if(typeof value!=="string"||!value||value.length>max)fail(name+"_STRING");
 return value as string
};

export function verifyLocalCouncilArtifacts(ledgerInput:unknown,dossierInput?:unknown){
 const ledger=obj(ledgerInput,"LEDGER");
 if(ledger.schema!=="phi-thinktank-local-council-result.v0.1")fail("LEDGER_SCHEMA");
 if(typeof ledger.contractSha256!=="string"||!/^[a-f0-9]{64}$/.test(ledger.contractSha256))fail("CONTRACT_SHA");
 const summary=obj(ledger.summary,"SUMMARY");
 if(typeof summary.mode!=="string"||!Object.hasOwn(modes,summary.mode))fail("MODE");
 const mode=summary.mode as Mode;
 const model=bounded(summary.model,"MODEL",90);
 if(typeof summary.turnsInvoked!=="number"||!Number.isInteger(summary.turnsInvoked)||
  summary.turnsInvoked<0||summary.turnsInvoked>modes[mode])fail("TURN_BUDGET");
 if(typeof summary.completed!=="boolean"||typeof summary.aborted!=="boolean"||
    summary.completed&&summary.aborted)fail("SUMMARY_STATUS");
 const authority=obj(ledger.authority,"AUTHORITY");
 if(authority.provider!=="ollama-local-only"||authority.executionAuthorityGranted!==false||
    authority.externalDoneAttested!==false||authority.independentEvidenceVerified!==false)fail("LOCAL_AUTHORITY");
 const reported=obj(ledger.replay,"REPORTED_REPLAY");
 if(reported.valid!==true||reported.exact!==true)fail("REPORTED_REPLAY_INCOMPLETE");
 if(!Array.isArray(ledger.events)||ledger.events.length===0||ledger.events.length>2000)fail("EVENT_ARRAY");
 const events=ledger.events as ThinkTankEvent[];
 const replay=verifyReplay(createInitialState(),events);
 if(!replay.valid||!replay.exact)fail("KERNEL_"+String(replay.error??"REPLAY_INVALID").slice(0,220));
 const state=replayEvents(createInitialState(),events);
 if(state.mode!==mode||state.events.length!==events.length)fail("REPLAY_MODE");
 if(reported.eventCount!==events.length||reported.finalFingerprint!==replay.finalFingerprint)fail("REPORTED_REPLAY_MISMATCH");
 const expectedSession=bounded(events[0]?.sessionId,"SESSION",180);
 if(state.sessionId!==expectedSession)fail("SESSION");
 const providerTurns=events.filter(event=>
    event.source==="provider"&&["utterance.complete","challenge.raised"].includes(event.kind));
 if(providerTurns.length>summary.turnsInvoked)fail("TURN_COUNT");
 if(providerTurns.some(e=>e.seatId!=="local"||e.providerModel!==model))fail("PROVIDER_SCOPE");
 const decision=state.decisionDossiers.slice(-1)[0]??null;
 let dossierMatch:"NOT_SUPPLIED"|"EXACT"="NOT_SUPPLIED";
 let dossierId:string|null=null;
 if(dossierInput!==undefined){
  const envelope=obj(dossierInput,"DOSSIER_ENVELOPE");
  const document=obj(envelope.dossier,"DOSSIER");
  if(!decision||stableStringify(decision)!==stableStringify(document))fail("DOSSIER_MISMATCH");
  dossierMatch="EXACT";
  dossierId=decision.id;
 }
 return Object.freeze({
  schema:LOCAL_REPLAY_REPORT_SCHEMA,
  // The CLI adds byte-level SHA256 bindings. This function only replays events.
  execution:"LOCAL_KERNEL_REPLAY_ONLY",
  result:"KERNEL_REPLAY_PASS",
  ledgerSchema:ledger.schema as string,
  mode,model,
  contractSha256:ledger.contractSha256 as string,
  sessionId:state.sessionId,
  eventCount:events.length,
  providerTurnCount:providerTurns.length,
  finalFingerprint:replay.finalFingerprint,
  dossierId:dossierId??decision?.id??null,
  dossierMatch,
  synthesisOutcome:decision?.outcome??"NOT_REACHED",
  authGranted:false,
  externalDone:false,
  truthAuthority:false,
  signerAuthenticated:false,
  replayKernel:"think-tank/src/kernel/eventKernel.ts"
 });
}
