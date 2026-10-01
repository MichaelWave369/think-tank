import type { ThinkTankEvent,ThinkTankEventInput,ThinkTankState } from "../domain/types";
import { projectEvent } from "../domain/reducer";
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

  if(event.kind==="gate.scored"){
    if(!state.turnPlan)throw new KernelIntegrityError("Reality Gate scored before a schedule was planned.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("Reality Gate cannot score while a speaker is active.",event.seq);
    if(state.speakerIndex<state.turnPlan.speakerQueue.length){
      throw new KernelIntegrityError("Reality Gate cannot score before the scheduled queue completes.",event.seq);
    }
    if(event.gateScore===undefined||event.gateScore<0||event.gateScore>1){
      throw new KernelIntegrityError("Reality Gate score must be between 0 and 1.",event.seq);
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
