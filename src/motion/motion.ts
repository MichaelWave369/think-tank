import type { SeatId,ThinkTankEvent,ThinkTankState } from "../domain/types";

export type MotionMode="full"|"reduced"|"paused";
export type MotionCueKind=
  |"idle"|"wake"|"route"|"assign"|"speak"|"challenge"
  |"gate-pass"|"gate-block"|"fault"|"complete"|"override"|"abort"|"ledger";

export interface MotionCue{
  seq:number;
  kind:MotionCueKind;
  roleId?:ThinkTankEvent["roleId"];
  seatId?:SeatId;
  label:string;
  intensity:"low"|"medium"|"high";
}

const seatForRole=(state:ThinkTankState,roleId?:ThinkTankEvent["roleId"]):SeatId|undefined=>
  state.assignments.find(assignment=>assignment.roleId===roleId)?.seatId;

export function deriveMotionCue(event:ThinkTankEvent|undefined,state:ThinkTankState):MotionCue{
  if(!event)return {seq:0,kind:"idle",label:"ROOM IDLE",intensity:"low"};

  const base={
    seq:event.seq,
    roleId:event.roleId,
    seatId:event.seatId??seatForRole(state,event.roleId)
  };

  switch(event.kind){
    case "session.started":
      return {...base,kind:"wake",label:"ROOM WAKE",intensity:"medium"};
    case "role.assigned":
      return {...base,kind:"assign",label:"CRANE FLY → "+(event.roleId??"ROLE").toUpperCase(),intensity:"medium"};
    case "turn.started":
      return {...base,kind:"route",label:"ROUTE TO "+(event.roleId??"ROLE").toUpperCase(),intensity:"medium"};
    case "utterance.complete":
      return {...base,kind:"speak",label:(event.roleId??"ROLE").toUpperCase()+" UTTERANCE",intensity:"medium"};
    case "challenge.raised":
      return {...base,kind:"challenge",label:"CHALLENGE RAISED",intensity:"high"};
    case "gate.scored":
      return event.gateScore!==undefined&&event.gateScore>=state.gateThreshold
        ?{...base,kind:"gate-pass",label:"REALITY GATE PASS",intensity:"high"}
        :{...base,kind:"gate-block",label:"REALITY GATE BELOW THRESHOLD",intensity:"high"};
    case "governance.fault":
    case "turn.timeout":
      return {...base,kind:"fault",label:event.faultCode??"GOVERNANCE FAULT",intensity:"high"};
    case "synthesis.withheld":
      return {...base,kind:"gate-block",label:"SYNTHESIS WITHHELD",intensity:"high"};
    case "synthesis.completed":
      return {...base,kind:"complete",label:"SYNTHESIS COMPLETE",intensity:"high"};
    case "operator.override":
      return {...base,kind:"override",label:"OPERATOR OVERRIDE",intensity:"high"};
    case "session.aborted":
      return {...base,kind:"abort",label:"SESSION ABORT",intensity:"high"};
    default:
      return {...base,kind:"ledger",label:event.kind.toUpperCase(),intensity:"low"};
  }
}
