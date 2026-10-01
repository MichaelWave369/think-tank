import { useMemo,useReducer,useState } from "react";
import { roles,seats } from "../data/terminals";
import { createInitialState } from "../domain/state";
import { thinkTankReducer } from "../domain/reducer";
import type { CollaborationMode,RoleId,TerminalState,ThinkTankEventInput } from "../domain/types";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "../kernel/eventKernel";
import { scenarioEventInputs,type DemoScenario } from "../sim/demo";
import { TerminalPanel } from "./TerminalPanel";
import { Commonline } from "./Commonline";
import { GovernancePanel } from "./GovernancePanel";
import { OperatorRail } from "./OperatorRail";
import { ModeBar } from "./ModeBar";
import { SystemStatus } from "./SystemStatus";
import { LedgerRoll } from "./LedgerRoll";

const seatStatePriority:TerminalState[]=["warning","speaking","thinking","selected","listening","idle","dimmed","offline"];

export function ThinkTankRoom(){
  const [state,dispatch]=useReducer(thinkTankReducer,createInitialState());
  const [prompt,setPrompt]=useState("");

  const activeRole=useMemo(
    ()=>[...state.events].reverse().find(event=>event.roleId)?.roleId,
    [state.events]
  );

  const replayReport=useMemo(
    ()=>verifyReplay(createInitialState(),state.events,state),
    [state]
  );

  const seatName=(roleId:string)=>{
    const assignment=state.assignments.find(item=>item.roleId===roleId);
    return seats.find(seat=>seat.id===assignment?.seatId)?.name??"UNASSIGNED";
  };

  const phaseForRole=(roleId:RoleId)=>{
    return [...state.events].reverse().find(event=>event.roleId===roleId)?.phase;
  };

  const assignedRolesForSeat=(seatId:string)=>{
    return state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId.toUpperCase());
  };

  const stateForSeat=(seatId:string):TerminalState=>{
    const roleIds=state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId);
    if(roleIds.length===0)return "idle";
    const states=roleIds.map(roleId=>state.terminalStates[roleId]);
    return seatStatePriority.find(candidate=>states.includes(candidate))??"idle";
  };

  const emitInput=(input:ThinkTankEventInput)=>{
    dispatch({type:"APPLY_EVENT",event:buildEvent(state,input)});
  };

  const runScenario=(scenario:DemoScenario)=>{
    const events=buildEventBatch(state,scenarioEventInputs(prompt,state.mode,scenario));
    for(const event of events)dispatch({type:"APPLY_EVENT",event});
    setPrompt("");
  };

  const selectMode=(mode:CollaborationMode)=>{
    emitInput({
      source:"operator",
      kind:"mode.selected",
      mode,
      phase:"intake",
      message:"Operator selected "+mode.toUpperCase()+" mode."
    });
  };

  const abort=()=>emitInput({
    source:"operator",
    kind:"session.aborted",
    phase:"aborted",
    message:"Operator abort. Session halted."
  });

  const canForce=state.synthesisWithheld||Boolean(state.faultCode);

  const force=()=>{
    if(!canForce)return;
    emitInput({
      source:"operator",
      kind:"operator.override",
      phase:"synthesis",
      override:true,
      outputLabel:state.mode==="audit"?"AUDIT":"STANDARD",
      actionAllowed:true,
      governanceReason:"Human operator explicitly overrode the withheld/faulted synthesis state.",
      message:"Operator override recorded: FORCE SYNTHESIS."
    });
  };

  const replayExact=()=>{
    const restored=replayEvents(createInitialState(),state.events);
    dispatch({type:"RESET",state:restored});
  };

  return <main className="room-shell">
    <div className="scanlines" aria-hidden="true"/>

    <header className="room-header">
      <div><small>SUPER Φ.VESSEL</small><strong>Φ THINK TANK</strong><span>Multi-Mind Terminal for Super Φ.Vessel</span></div>
      <p>MULTI-MIND COLLABORATION<br/>A BRIGHTER REALITY TOGETHER.</p>
    </header>

    <button className="room-map-chip" aria-label="Room map">ROOM MAP · ROLES / COMMONLINE / OPERATOR / LEDGER</button>

    <section className="role-wall" aria-label="Cognitive role terminals">
      {roles.map(role=><TerminalPanel
        key={role.id}
        kind="role"
        terminal={role}
        state={state.terminalStates[role.id]}
        utterance={state.lastUtterance[role.id]}
        staffedBy={seatName(role.id)}
        phase={phaseForRole(role.id)}
      />)}
    </section>

    <section className="operations-grid">
      <aside className="seat-stack" aria-label="Provider and model seats">
        {seats.map(seat=><TerminalPanel
          key={seat.id}
          kind="seat"
          terminal={seat}
          assignedRoles={assignedRolesForSeat(seat.id)}
          state={stateForSeat(seat.id)}
        />)}
      </aside>

      <div className="center-stack">
        <Commonline assignments={state.assignments} activeRole={activeRole} seats={seats}/>

        <GovernancePanel
          state={state}
          onGateBlock={()=>runScenario("council-gate-block")}
          onTimeout={()=>runScenario("timeout")}
        />

        {state.synthesisWithheld&&<div className="gate-block">
          <strong>SYNTHESIS WITHHELD</strong>
          <span>{state.governanceReason||"The active mode law did not authorize synthesis."}</span>
        </div>}

        <OperatorRail
          sessionId={state.sessionId}
          seed={state.seed}
          prompt={prompt}
          canForce={canForce}
          onPrompt={setPrompt}
          onSend={()=>runScenario("happy")}
          onAbort={abort}
          onForce={force}
        />

        <ModeBar mode={state.mode} onChange={selectMode}/>
      </div>

      <SystemStatus state={state} replayReport={replayReport}/>
    </section>

    <LedgerRoll events={state.events} replayReport={replayReport} onReplay={replayExact}/>
  </main>;
}
