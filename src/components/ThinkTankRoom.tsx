import { useMemo,useReducer,useState } from "react";
import { roles,seats } from "../data/terminals";
import { createInitialState } from "../domain/state";
import { thinkTankReducer } from "../domain/reducer";
import type { ThinkTankEvent } from "../domain/types";
import { demoEvents } from "../sim/demo";
import { TerminalPanel } from "./TerminalPanel";
import { Commonline } from "./Commonline";
import { OperatorRail } from "./OperatorRail";
import { ModeBar } from "./ModeBar";
import { SystemStatus } from "./SystemStatus";
import { LedgerRoll } from "./LedgerRoll";

export function ThinkTankRoom(){
 const [state,dispatch]=useReducer(thinkTankReducer,createInitialState());
 const [prompt,setPrompt]=useState("");
 const activeRole=useMemo(()=>[...state.events].reverse().find(e=>e.roleId)?.roleId,[state.events]);
 const seatName=(roleId:string)=>{const a=state.assignments.find(x=>x.roleId===roleId);return seats.find(s=>s.id===a?.seatId)?.name??"UNASSIGNED";};
 const emit=(event:ThinkTankEvent)=>dispatch({type:"APPEND_EVENT",event});
 const runDemo=()=>{demoEvents(state.sessionId,state.seed,state.mode,state.seq).forEach(emit);setPrompt("");};
 const abort=()=>emit({sessionId:state.sessionId,seed:state.seed,mode:state.mode,seq:state.seq+1,kind:"session.aborted",phase:"aborted",message:"Operator abort. Session halted."});
 const force=()=>emit({sessionId:state.sessionId,seed:state.seed,mode:state.mode,seq:state.seq+1,kind:"operator.override",phase:"synthesis",override:true,message:"Operator override recorded: FORCE SYNTHESIS."});
 return <main className="room-shell">
  <div className="scanlines" aria-hidden="true"/>
  <header className="room-header"><div><small>SUPER Φ.VESSEL</small><strong>Φ THINK TANK</strong><span>Multi-Mind Terminal for Super Φ.Vessel</span></div><p>MULTI-MIND COLLABORATION<br/>A BRIGHTER REALITY TOGETHER.</p></header>
  <button className="room-map-chip" aria-label="Room map">ROOM MAP · ROLES / COMMONLINE / OPERATOR / LEDGER</button>
  <section className="role-wall">{roles.map(role=><TerminalPanel key={role.id} kind="role" terminal={role} state={state.terminalStates[role.id]} utterance={state.lastUtterance[role.id]} staffedBy={seatName(role.id)}/>)}</section>
  <section className="operations-grid">
   <div className="seat-stack">{seats.map(seat=>{const assigned=state.assignments.filter(a=>a.seatId===seat.id).map(a=>a.roleId.toUpperCase()).join(", ");return <TerminalPanel key={seat.id} kind="seat" terminal={seat} assignment={assigned||"UNASSIGNED"}/>;})}</div>
   <div className="center-stack">
    <Commonline assignments={state.assignments} activeRole={activeRole} seats={seats}/>
    {state.synthesisWithheld&&<div className="gate-block"><strong>SYNTHESIS WITHHELD</strong><span>Reality Gate {state.gateScore?.toFixed(2)} is below {state.gateThreshold.toFixed(2)}. Operator may force synthesis; override will be ledgered.</span></div>}
    <OperatorRail sessionId={state.sessionId} seed={state.seed} prompt={prompt} onPrompt={setPrompt} onSend={runDemo} onAbort={abort} onForce={force}/>
    <ModeBar mode={state.mode} onChange={mode=>dispatch({type:"SET_MODE",mode})}/>
   </div>
   <SystemStatus state={state}/>
  </section>
  <LedgerRoll events={state.events}/>
 </main>;
}
