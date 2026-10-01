import type { ThinkTankEvent,ThinkTankEventInput,ThinkTankState } from "../domain/types";
import { projectEvent } from "../domain/reducer";
import { fingerprintProjection } from "./fingerprint";

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
    message:input.message,
    gateScore:input.gateScore,
    override:input.override,
    stateBefore,
    stateAfter:"pending"
  };

  const projected=projectEvent(state,draft);

  return {
    ...draft,
    stateAfter:fingerprintProjection(projected)
  };
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
    throw new KernelIntegrityError(
      "Sequence discontinuity: expected "+expectedSeq+", received "+event.seq+".",
      event.seq
    );
  }

  const actualBefore=fingerprintProjection(state);
  if(event.stateBefore!==actualBefore){
    throw new KernelIntegrityError(
      "Pre-state fingerprint mismatch at seq "+event.seq+".",
      event.seq
    );
  }

  const projected=projectEvent(state,event);
  const actualAfter=fingerprintProjection(projected);

  if(event.stateAfter!==actualAfter){
    throw new KernelIntegrityError(
      "Post-state fingerprint mismatch at seq "+event.seq+".",
      event.seq
    );
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
