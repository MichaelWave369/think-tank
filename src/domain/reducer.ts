import type { CollaborationMode,ThinkTankEvent,ThinkTankState,TerminalState } from "./types";
import { routerForMode } from "./modes";

export type ThinkTankAction=
  |{type:"SET_MODE";mode:CollaborationMode}
  |{type:"APPEND_EVENT";event:ThinkTankEvent}
  |{type:"RESET";state:ThinkTankState};

const listeningWall=(state:ThinkTankState):Record<keyof ThinkTankState["terminalStates"],TerminalState>=>({
  vessie:state.terminalStates.vessie==="offline"?"offline":"listening",
  dreamer:state.terminalStates.dreamer==="offline"?"offline":"listening",
  builder:state.terminalStates.builder==="offline"?"offline":"listening",
  challenger:state.terminalStates.challenger==="offline"?"offline":"listening",
  archivist:state.terminalStates.archivist==="offline"?"offline":"listening"
});

export function thinkTankReducer(state:ThinkTankState,action:ThinkTankAction):ThinkTankState{
  if(action.type==="RESET")return action.state;
  if(action.type==="SET_MODE")return {...state,mode:action.mode,routerPolicy:routerForMode(action.mode)};

  const event=action.event;
  const next:ThinkTankState={
    ...state,
    seq:event.seq,
    phase:event.phase,
    gateScore:event.gateScore??state.gateScore,
    events:[...state.events,event]
  };

  if(event.kind==="session.started"){
    next.terminalStates=listeningWall(state);
  }

  if(event.kind==="turn.started"&&event.roleId){
    next.terminalStates={...listeningWall(state),[event.roleId]:"speaking"};
  }

  if(event.roleId&&event.message&&(event.kind==="utterance.complete"||event.kind==="challenge.raised")){
    next.lastUtterance={...state.lastUtterance,[event.roleId]:event.message};
    next.terminalStates={
      ...next.terminalStates,
      [event.roleId]:event.kind==="challenge.raised"?"warning":"listening"
    };
  }

  if(event.kind==="gate.scored")next.synthesisWithheld=(event.gateScore??0)<state.gateThreshold;
  if(event.kind==="operator.override"||event.kind==="synthesis.completed")next.synthesisWithheld=false;
  if(event.kind==="synthesis.withheld")next.synthesisWithheld=true;

  if(event.kind==="session.aborted"){
    next.phase="aborted";
    next.terminalStates={vessie:"idle",dreamer:"idle",builder:"idle",challenger:"idle",archivist:"idle"};
  }

  return next;
}
