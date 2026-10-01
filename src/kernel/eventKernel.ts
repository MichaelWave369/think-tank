import type { ThinkTankEvent,ThinkTankEventInput,ThinkTankState } from "../domain/types";
import { projectEvent } from "../domain/reducer";
import { evaluateEvidence } from "../domain/evidence";
import { evaluateGovernance,initialTurnPlan } from "../domain/scheduler";
import { fingerprintProjection } from "./fingerprint";
import { stableStringify } from "./stable";

export class KernelIntegrityError extends Error{
  constructor(message:string,public readonly seq?:number){
    super(message);
    this.name="KernelIntegrityError";
  }
}

export interface ReplayReport{
  valid:boolean;
  exact:boolean;
  eventCount:number;
  finalFingerprint:string;
  expectedFingerprint?:string;
  error?:string;
}

function assertResearchEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const researchAction=
    event.kind==="research.search.requested"||
    event.kind==="research.search.completed"||
    event.kind==="research.search.failed";

  if(researchAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Research search cannot run during an active governed session.",event.seq);
  }

  const assertClaimAndQuery=()=>{
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Research search requires an existing claim.",event.seq);
    }
    if(!event.researchQuery?.trim()){
      throw new KernelIntegrityError("Research search requires a query.",event.seq);
    }
    if(event.researchQuery.trim().length>300){
      throw new KernelIntegrityError("Research query exceeds the 300 character limit.",event.seq);
    }
  };

  if(event.kind==="research.search.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Research search requests are operator-authorized.",event.seq);
    }
    assertClaimAndQuery();
    return true;
  }

  if(event.kind==="research.search.failed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Research search failure must be tool-originated.",event.seq);
    }
    assertClaimAndQuery();

    const request=[...state.events].reverse().find(item=>
      item.kind==="research.search.requested"&&
      item.claimId===event.claimId&&
      item.researchQuery===event.researchQuery
    );
    if(!request){
      throw new KernelIntegrityError("Research failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="research.search.completed"||item.kind==="research.search.failed")&&
      item.claimId===event.claimId&&
      item.researchQuery===event.researchQuery
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Research request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="research.search.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Research search completion must be tool-originated.",event.seq);
    }

    const receipt=event.researchReceipt;
    if(!receipt){
      throw new KernelIntegrityError("Research completion requires a search receipt.",event.seq);
    }
    if(receipt.tool!=="searxng-search"||receipt.provider!=="searxng"){
      throw new KernelIntegrityError("Research receipt must originate from the SearXNG search adapter.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===receipt.claimId)){
      throw new KernelIntegrityError("Research receipt references an unknown claim.",event.seq);
    }
    if(!receipt.query.trim()||receipt.query.length>300){
      throw new KernelIntegrityError("Research receipt query is invalid.",event.seq);
    }
    if(Number.isNaN(Date.parse(receipt.searchedAt))){
      throw new KernelIntegrityError("Research receipt timestamp is invalid.",event.seq);
    }
    if(!/^[a-f0-9]{64}$/.test(receipt.resultDigest)){
      throw new KernelIntegrityError("Research receipt requires a lowercase SHA-256 result digest.",event.seq);
    }
    if(receipt.candidates.length>10){
      throw new KernelIntegrityError("Research receipt exceeds the 10 candidate kernel cap.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="research.search.requested"&&
      item.claimId===receipt.claimId&&
      item.researchQuery===receipt.query
    );
    if(!request){
      throw new KernelIntegrityError("Research completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="research.search.completed"||item.kind==="research.search.failed")&&
      item.claimId===receipt.claimId&&
      item.researchQuery===receipt.query
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Research request is already resolved.",event.seq);
    }

    const ids=new Set<string>();
    const uris=new Set<string>();
    for(let index=0;index<receipt.candidates.length;index++){
      const candidate=receipt.candidates[index];
      if(!candidate.id.trim()||ids.has(candidate.id)||state.researchCandidates.some(item=>item.id===candidate.id)){
        throw new KernelIntegrityError("Research candidate id is missing or duplicated.",event.seq);
      }
      ids.add(candidate.id);

      if(candidate.claimId!==receipt.claimId||candidate.query!==receipt.query){
        throw new KernelIntegrityError("Research candidate does not match its receipt claim/query.",event.seq);
      }
      if(candidate.discoveredAt!==receipt.searchedAt){
        throw new KernelIntegrityError("Research candidate timestamp must match the receipt.",event.seq);
      }
      if(candidate.rank!==index+1){
        throw new KernelIntegrityError("Research candidate ranks must be contiguous from 1.",event.seq);
      }
      if(!candidate.title.trim()||!candidate.engine.trim()){
        throw new KernelIntegrityError("Research candidate requires title and engine.",event.seq);
      }

      let url:URL;
      try{url=new URL(candidate.uri);}catch{
        throw new KernelIntegrityError("Research candidate URI is invalid.",event.seq);
      }
      if((url.protocol!=="http:"&&url.protocol!=="https:")||url.username||url.password){
        throw new KernelIntegrityError("Research candidate URI must be credential-free HTTP/S.",event.seq);
      }

      const normalized=url.toString();
      if(uris.has(normalized)||state.researchCandidates.some(item=>
        item.claimId===candidate.claimId&&item.uri===normalized
      )){
        throw new KernelIntegrityError("Research candidate URI is duplicated for this claim.",event.seq);
      }
      uris.add(normalized);
    }
    return true;
  }

  return false;
}

function assertClaimEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const claimAction=
    event.kind==="claim.added"||
    event.kind==="claim.removed"||
    event.kind==="evidence.bound"||
    event.kind==="evidence.unbound";

  if(claimAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Claim graph cannot mutate during an active governed session.",event.seq);
  }

  if(event.kind==="claim.added"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Claim creation is operator-authorized.",event.seq);
    }
    const claim=event.claim;
    if(!claim||!claim.id.trim()||!claim.text.trim()){
      throw new KernelIntegrityError("Claim add event requires id and text.",event.seq);
    }
    if(claim.addedBy!=="operator"){
      throw new KernelIntegrityError("Claim must declare addedBy=operator.",event.seq);
    }
    if(state.claims.some(existing=>existing.id===claim.id)){
      throw new KernelIntegrityError("Claim id already exists: "+claim.id+".",event.seq);
    }
    if(state.claims.some(existing=>existing.text.trim().toLowerCase()===claim.text.trim().toLowerCase())){
      throw new KernelIntegrityError("An equivalent claim already exists.",event.seq);
    }
    return true;
  }

  if(event.kind==="claim.removed"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Claim removal is operator-authorized.",event.seq);
    }
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Claim removal requires an existing claim id.",event.seq);
    }
    if(state.claimBindings.some(binding=>binding.claimId===event.claimId)){
      throw new KernelIntegrityError("Cannot remove a claim while evidence bindings still exist.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.bound"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence binding is operator-authorized.",event.seq);
    }
    const binding=event.claimBinding;
    if(!binding||!binding.id.trim()||!binding.claimId.trim()||!binding.evidenceId.trim()){
      throw new KernelIntegrityError("Evidence binding requires binding, claim, and evidence ids.",event.seq);
    }
    if(binding.addedBy!=="operator"){
      throw new KernelIntegrityError("Evidence binding must declare addedBy=operator.",event.seq);
    }
    if(!["supports","contradicts","context"].includes(binding.relation)){
      throw new KernelIntegrityError("Evidence binding relation is invalid.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===binding.claimId)){
      throw new KernelIntegrityError("Evidence binding references an unknown claim.",event.seq);
    }
    if(!state.evidenceRefs.some(ref=>ref.id===binding.evidenceId)){
      throw new KernelIntegrityError("Evidence binding references unknown evidence.",event.seq);
    }
    if(state.claimBindings.some(existing=>existing.id===binding.id)){
      throw new KernelIntegrityError("Claim binding id already exists: "+binding.id+".",event.seq);
    }
    if(state.claimBindings.some(existing=>
      existing.claimId===binding.claimId&&existing.evidenceId===binding.evidenceId
    )){
      throw new KernelIntegrityError("Evidence is already bound to this claim; unbind before changing relation.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.unbound"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence unbinding is operator-authorized.",event.seq);
    }
    if(!event.claimBindingId||!state.claimBindings.some(binding=>binding.id===event.claimBindingId)){
      throw new KernelIntegrityError("Evidence unbind requires an existing claim binding id.",event.seq);
    }
    return true;
  }

  return false;
}

function assertEvidenceEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const evidenceAction=
    event.kind==="evidence.fetch.requested"||
    event.kind==="evidence.fetch.failed"||
    event.kind==="evidence.added"||
    event.kind==="evidence.removed";

  if(evidenceAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Evidence packet cannot mutate during an active governed session.",event.seq);
  }

  if(event.kind==="evidence.fetch.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence fetch requests are operator-authorized.",event.seq);
    }
    if(!event.evidenceUri?.trim()){
      throw new KernelIntegrityError("Evidence fetch request requires a URI.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.fetch.failed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Evidence fetch failure must be tool-originated.",event.seq);
    }
    if(!event.evidenceUri?.trim()){
      throw new KernelIntegrityError("Evidence fetch failure requires the requested URI.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.added"){
    const ref=event.evidenceRef;
    if(!ref)throw new KernelIntegrityError("Evidence add event requires an evidence reference.",event.seq);
    if(!ref.id.trim()||!ref.label.trim()){
      throw new KernelIntegrityError("Evidence reference requires id and label.",event.seq);
    }
    if(state.evidenceRefs.some(existing=>existing.id===ref.id)){
      throw new KernelIntegrityError("Evidence id already exists: "+ref.id+".",event.seq);
    }
    if(event.source==="operator"){
      if(ref.addedBy!=="operator"){
        throw new KernelIntegrityError("Operator evidence must declare addedBy=operator.",event.seq);
      }
      if(ref.verification==="machine-verified"){
        throw new KernelIntegrityError("Operator evidence cannot self-declare machine verification.",event.seq);
      }
    }else if(event.source==="tool"){
      if(ref.addedBy!=="tool"){
        throw new KernelIntegrityError("Tool evidence must declare addedBy=tool.",event.seq);
      }
      if(ref.verification!=="machine-verified"){
        throw new KernelIntegrityError("Tool evidence must declare machine verification.",event.seq);
      }
      if(ref.researchCandidateId){
        const candidate=state.researchCandidates.find(item=>item.id===ref.researchCandidateId);
        if(!candidate){
          throw new KernelIntegrityError("Machine evidence references an unknown research candidate.",event.seq);
        }
        if(state.evidenceRefs.some(existing=>existing.researchCandidateId===ref.researchCandidateId)){
          throw new KernelIntegrityError("Research candidate has already been promoted to evidence.",event.seq);
        }
        if(ref.retrieval?.requestedUri!==candidate.uri){
          throw new KernelIntegrityError("Research candidate URI must match the evidence retrieval request.",event.seq);
        }
      }
      if(ref.kind!=="external-source"){
        throw new KernelIntegrityError("Machine-retrieved evidence must use external-source kind.",event.seq);
      }

      const receipt=ref.retrieval;
      if(!receipt){
        throw new KernelIntegrityError("Machine-verified evidence requires a retrieval receipt.",event.seq);
      }
      if(receipt.tool!=="url-fetch"){
        throw new KernelIntegrityError("Unsupported evidence retrieval tool.",event.seq);
      }
      if(!receipt.requestedUri.trim()||!receipt.finalUri.trim()){
        throw new KernelIntegrityError("Retrieval receipt requires requested and final URIs.",event.seq);
      }
      if(ref.uri!==receipt.finalUri){
        throw new KernelIntegrityError("Evidence URI must match retrieval receipt final URI.",event.seq);
      }
      if(receipt.httpStatus<200||receipt.httpStatus>=300){
        throw new KernelIntegrityError("Machine-verified evidence requires a successful HTTP status.",event.seq);
      }
      if(!receipt.contentType.trim()){
        throw new KernelIntegrityError("Retrieval receipt requires a content type.",event.seq);
      }
      if(receipt.bytes<0||!Number.isFinite(receipt.bytes)){
        throw new KernelIntegrityError("Retrieval receipt byte count is invalid.",event.seq);
      }
      if(!/^[a-f0-9]{64}$/.test(receipt.sha256)){
        throw new KernelIntegrityError("Retrieval receipt requires a lowercase SHA-256 digest.",event.seq);
      }
      if(receipt.redirects<0||!Number.isInteger(receipt.redirects)){
        throw new KernelIntegrityError("Retrieval receipt redirect count is invalid.",event.seq);
      }
      if(Number.isNaN(Date.parse(receipt.retrievedAt))){
        throw new KernelIntegrityError("Retrieval receipt timestamp is invalid.",event.seq);
      }
    }else if(event.source==="system"){
      if(ref.addedBy!=="system"){
        throw new KernelIntegrityError("System evidence must declare addedBy=system.",event.seq);
      }
      if(ref.verification==="machine-verified"){
        throw new KernelIntegrityError("Machine verification is reserved for governed tool receipts.",event.seq);
      }
    }else{
      throw new KernelIntegrityError("Evidence may only be added by operator, system, or governed tool.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.removed"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence removal is operator-authorized.",event.seq);
    }
    if(!event.evidenceId||!state.evidenceRefs.some(ref=>ref.id===event.evidenceId)){
      throw new KernelIntegrityError("Evidence removal requires an existing evidence id.",event.seq);
    }
    if(state.claimBindings.some(binding=>binding.evidenceId===event.evidenceId)){
      throw new KernelIntegrityError("Cannot remove evidence while claim bindings still exist.",event.seq);
    }
    return true;
  }

  return false;
}

function assertRoutingEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  if(event.kind==="seat.status"){
    if(!event.seatId||!event.seatStatus){
      throw new KernelIntegrityError("Seat status event requires seat id and status.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.pinned"){
    if(!event.roleId||!event.seatId){
      throw new KernelIntegrityError("Role pin requires role id and seat id.",event.seq);
    }
    if(state.seatStatus[event.seatId]==="offline"){
      throw new KernelIntegrityError("Cannot pin a role to an offline seat.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.unpinned"){
    if(!event.roleId){
      throw new KernelIntegrityError("Role unpin requires role id.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.assigned"){
    if(!event.roleId||!event.seatId){
      throw new KernelIntegrityError("Role assignment requires role id and seat id.",event.seq);
    }
    if(state.seatStatus[event.seatId]==="offline"){
      throw new KernelIntegrityError("Cannot assign a role to an offline seat.",event.seq);
    }

    const pinned=state.pinnedAssignments[event.roleId];
    if(pinned&&pinned!==event.seatId){
      throw new KernelIntegrityError(
        "Assignment violates operator pin: "+event.roleId+" is pinned to "+pinned+".",
        event.seq
      );
    }

    if(event.assignmentOrigin!=="auto"&&event.assignmentOrigin!=="operator-pin"&&event.assignmentOrigin!=="bootstrap"){
      throw new KernelIntegrityError("Assignment event requires a valid origin.",event.seq);
    }

    if(event.assignmentScore===undefined||!Number.isFinite(event.assignmentScore)){
      throw new KernelIntegrityError("Assignment event requires a finite score.",event.seq);
    }

    if(!event.assignmentReason?.trim()){
      throw new KernelIntegrityError("Assignment event requires an explanation.",event.seq);
    }

    return true;
  }

  if(event.kind==="routing.completed"){
    if(event.source!=="system"){
      throw new KernelIntegrityError("Routing completion must be system-originated.",event.seq);
    }
    return true;
  }

  return false;
}

function assertPolicyEvent(state:ThinkTankState,event:ThinkTankEvent):void{
  if(assertResearchEvent(state,event))return;
  if(assertClaimEvent(state,event))return;
  if(assertEvidenceEvent(state,event))return;
  if(assertRoutingEvent(state,event))return;

  if(event.kind==="schedule.planned"){
    if(!event.turnPlan){
      throw new KernelIntegrityError("Schedule event is missing a turn plan.",event.seq);
    }

    const expected=initialTurnPlan(event.mode);
    if(stableStringify(event.turnPlan)!==stableStringify(expected)){
      throw new KernelIntegrityError("Schedule does not match the selected mode law.",event.seq);
    }
    return;
  }

  if(event.kind==="round.started"){
    if(!state.turnPlan)throw new KernelIntegrityError("Round started before a schedule was planned.",event.seq);
    if(event.round===undefined)throw new KernelIntegrityError("Round event is missing its round number.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("Cannot start a new round while a speaker is active.",event.seq);
    if(event.round!==state.currentRound+1){
      throw new KernelIntegrityError("Round discontinuity: expected "+(state.currentRound+1)+", received "+event.round+".",event.seq);
    }
    if(event.round>state.turnPlan.maxRounds){
      throw new KernelIntegrityError("Round cap exceeded for "+state.mode.toUpperCase()+".",event.seq);
    }
    if(state.currentRound>0&&state.speakerIndex<state.turnPlan.speakerQueue.length){
      throw new KernelIntegrityError("Cannot advance rounds before the scheduled queue completes.",event.seq);
    }
    return;
  }

  if(event.kind==="turn.started"){
    if(!state.turnPlan)throw new KernelIntegrityError("Turn started before a schedule was planned.",event.seq);
    if(state.currentRound<1)throw new KernelIntegrityError("Turn started before a round was opened.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("A second speaker cannot start while another turn is active.",event.seq);

    const expectedRole=state.turnPlan.speakerQueue[state.speakerIndex];
    if(!expectedRole)throw new KernelIntegrityError("Speaker queue is already complete.",event.seq);
    if(event.roleId!==expectedRole){
      throw new KernelIntegrityError(
        "Turn order violation: expected "+expectedRole+", received "+(event.roleId??"none")+".",
        event.seq
      );
    }
    return;
  }

  if(event.kind==="utterance.complete"||event.kind==="challenge.raised"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Utterance completed without an active speaker.",event.seq);
    }
    if(event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Utterance role mismatch: active speaker is "+state.currentSpeaker+".",event.seq);
    }
    if(event.kind==="challenge.raised"&&event.roleId!=="challenger"){
      throw new KernelIntegrityError("Only the Challenger role may emit challenge.raised.",event.seq);
    }
    return;
  }

  if(event.kind==="turn.timeout"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Timeout recorded without an active speaker.",event.seq);
    }
    if(event.roleId&&event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Timeout role does not match the active speaker.",event.seq);
    }
    return;
  }

  if(event.kind==="provider.failed"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Provider failure recorded without an active speaker.",event.seq);
    }
    if(event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Provider failure role does not match the active speaker.",event.seq);
    }
    if(!event.seatId){
      throw new KernelIntegrityError("Provider failure requires the responsible seat.",event.seq);
    }
    return;
  }

  if(event.kind==="gate.scored"){
    if(!state.turnPlan)throw new KernelIntegrityError("Reality Gate scored before a schedule was planned.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("Reality Gate cannot score while a speaker is active.",event.seq);
    if(state.speakerIndex<state.turnPlan.speakerQueue.length){
      throw new KernelIntegrityError("Reality Gate cannot score before the scheduled queue completes.",event.seq);
    }
    if(event.gateScore===undefined||event.gateScore<0||event.gateScore>1){
      throw new KernelIntegrityError("Reality Gate score must be between 0 and 1.",event.seq);
    }

    if(event.gateBreakdown){
      const expected=evaluateEvidence(state);
      if(stableStringify(event.gateBreakdown)!==stableStringify(expected)){
        throw new KernelIntegrityError("Reality Gate breakdown does not match deterministic evidence evaluation.",event.seq);
      }
      if(event.gateScore!==expected.finalScore){
        throw new KernelIntegrityError(
          "Reality Gate score mismatch: expected "+expected.finalScore+", received "+event.gateScore+".",
          event.seq
        );
      }
    }
    return;
  }

  if(event.kind==="synthesis.completed"||event.kind==="synthesis.withheld"){
    if(!state.turnPlan)throw new KernelIntegrityError("Synthesis resolved before a schedule was planned.",event.seq);

    const decision=evaluateGovernance(
      state.mode,
      state.gateScore??0,
      state.gateThreshold,
      state.objectionCount,
      Boolean(state.faultCode)
    );

    const expectedKind=decision.synthesisAllowed?"synthesis.completed":"synthesis.withheld";
    if(event.kind!==expectedKind){
      throw new KernelIntegrityError(
        "Governance violation: mode law requires "+expectedKind+", received "+event.kind+".",
        event.seq
      );
    }
    if(event.outputLabel!==decision.outputLabel){
      throw new KernelIntegrityError("Governance label mismatch: expected "+decision.outputLabel+".",event.seq);
    }
    if(Boolean(event.actionAllowed)!==decision.actionAllowed){
      throw new KernelIntegrityError("Action authorization contradicts the mode law.",event.seq);
    }
    return;
  }

  if(event.kind==="operator.override"){
    if(!state.synthesisWithheld&&!state.faultCode){
      throw new KernelIntegrityError("Operator override requires a withheld or faulted session.",event.seq);
    }
  }
}

export function buildEvent(state:ThinkTankState,input:ThinkTankEventInput):ThinkTankEvent{
  const stateBefore=fingerprintProjection(state);

  const draft:ThinkTankEvent={
    schemaVersion:1,
    sessionId:state.sessionId,
    seq:state.seq+1,
    seed:state.seed,
    source:input.source,
    mode:input.mode??state.mode,
    kind:input.kind,
    phase:input.phase??state.phase,
    roleId:input.roleId,
    seatId:input.seatId,
    seatStatus:input.seatStatus,
    assignmentScore:input.assignmentScore,
    assignmentReason:input.assignmentReason,
    assignmentOrigin:input.assignmentOrigin,
    providerModel:input.providerModel,
    providerLatencyMs:input.providerLatencyMs,
    providerRequestId:input.providerRequestId,
    claim:input.claim,
    claimId:input.claimId,
    claimBinding:input.claimBinding,
    claimBindingId:input.claimBindingId,
    researchQuery:input.researchQuery,
    researchReceipt:input.researchReceipt,
    researchCandidateId:input.researchCandidateId,
    evidenceRef:input.evidenceRef,
    evidenceId:input.evidenceId,
    evidenceUri:input.evidenceUri,
    gateBreakdown:input.gateBreakdown,
    message:input.message,
    gateScore:input.gateScore,
    override:input.override,
    turnPlan:input.turnPlan,
    round:input.round,
    faultCode:input.faultCode,
    outputLabel:input.outputLabel,
    actionAllowed:input.actionAllowed,
    governanceReason:input.governanceReason,
    stateBefore,
    stateAfter:"pending"
  };

  assertPolicyEvent(state,draft);
  const projected=projectEvent(state,draft);

  return {...draft,stateAfter:fingerprintProjection(projected)};
}

export function buildEventBatch(state:ThinkTankState,inputs:ThinkTankEventInput[]):ThinkTankEvent[]{
  const events:ThinkTankEvent[]=[];
  let projected=state;

  for(const input of inputs){
    const event=buildEvent(projected,input);
    events.push(event);
    projected=projectEvent(projected,event);
  }

  return events;
}

export function applyVerifiedEvent(state:ThinkTankState,event:ThinkTankEvent):ThinkTankState{
  if(event.schemaVersion!==1){
    throw new KernelIntegrityError("Unsupported event schema version.",event.seq);
  }

  if(event.sessionId!==state.sessionId){
    throw new KernelIntegrityError(
      "Session mismatch at seq "+event.seq+": expected "+state.sessionId+", received "+event.sessionId+".",
      event.seq
    );
  }

  if(event.seed!==state.seed){
    throw new KernelIntegrityError(
      "Seed mismatch at seq "+event.seq+": expected "+state.seed+", received "+event.seed+".",
      event.seq
    );
  }

  const expectedSeq=state.seq+1;
  if(event.seq!==expectedSeq){
    throw new KernelIntegrityError("Sequence discontinuity: expected "+expectedSeq+", received "+event.seq+".",event.seq);
  }

  const actualBefore=fingerprintProjection(state);
  if(event.stateBefore!==actualBefore){
    throw new KernelIntegrityError("Pre-state fingerprint mismatch at seq "+event.seq+".",event.seq);
  }

  assertPolicyEvent(state,event);
  const projected=projectEvent(state,event);
  const actualAfter=fingerprintProjection(projected);

  if(event.stateAfter!==actualAfter){
    throw new KernelIntegrityError("Post-state fingerprint mismatch at seq "+event.seq+".",event.seq);
  }

  return projected;
}

export function replayEvents(initialState:ThinkTankState,events:ThinkTankEvent[]):ThinkTankState{
  return events.reduce((state,event)=>applyVerifiedEvent(state,event),initialState);
}

export function verifyReplay(
  initialState:ThinkTankState,
  events:ThinkTankEvent[],
  expectedState?:ThinkTankState
):ReplayReport{
  try{
    const replayed=replayEvents(initialState,events);
    const finalFingerprint=fingerprintProjection(replayed);
    const expectedFingerprint=expectedState?fingerprintProjection(expectedState):undefined;

    return {
      valid:true,
      exact:expectedFingerprint===undefined||finalFingerprint===expectedFingerprint,
      eventCount:events.length,
      finalFingerprint,
      expectedFingerprint
    };
  }catch(error){
    return {
      valid:false,
      exact:false,
      eventCount:events.length,
      finalFingerprint:"",
      expectedFingerprint:expectedState?fingerprintProjection(expectedState):undefined,
      error:error instanceof Error?error.message:String(error)
    };
  }
}
