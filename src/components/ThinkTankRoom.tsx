import { useCallback,useMemo,useReducer,useState } from "react";
import { roles,seats } from "../data/terminals";
import { planAssignments,routingEventInputs,scoreSeatForRole } from "../domain/craneFly";
import { createInitialState } from "../domain/state";
import { thinkTankReducer } from "../domain/reducer";
import type {
  CollaborationMode,
  RoleId,
  SeatAvailability,
  SeatId,
  TerminalState,
  ThinkTankEvent,
  ThinkTankEventInput
} from "../domain/types";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "../kernel/eventKernel";
import { deriveMotionCue } from "../motion/motion";
import { useEventPlayback } from "../motion/useEventPlayback";
import { useMotionPolicy } from "../motion/useMotionPolicy";
import { scenarioEventInputs,type DemoScenario } from "../sim/demo";
import { TerminalPanel } from "./TerminalPanel";
import { Commonline } from "./Commonline";
import { CraneFlyPanel } from "./CraneFlyPanel";
import { GovernancePanel } from "./GovernancePanel";
import { OperatorRail } from "./OperatorRail";
import { ModeBar } from "./ModeBar";
import { MotionLayer } from "./MotionLayer";
import { SystemStatus } from "./SystemStatus";
import { LedgerRoll } from "./LedgerRoll";

const seatStatePriority:TerminalState[]=["warning","speaking","thinking","selected","listening","idle","dimmed","offline"];

export function ThinkTankRoom(){
  const [state,dispatch]=useReducer(thinkTankReducer,createInitialState());
  const [prompt,setPrompt]=useState("");
  const motionMode=useMotionPolicy();

  const applyEvent=useCallback((event:ThinkTankEvent)=>{
    dispatch({type:"APPLY_EVENT",event});
  },[]);

  const playback=useEventPlayback(applyEvent,motionMode);

  const latestEvent=state.events[state.events.length-1];
  const cue=useMemo(()=>deriveMotionCue(latestEvent,state),[latestEvent,state]);

  const routingPreview=useMemo(
    ()=>planAssignments(state,seats,state.mode),
    [state]
  );
  const routeReady=routingPreview.unresolved.length===0;

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

  const assignmentMeta=(roleId:RoleId)=>{
    const origin=state.assignmentOrigins[roleId]?.toUpperCase()??"UNROUTED";
    const score=state.assignmentScores[roleId];
    const pinned=state.pinnedAssignments[roleId]?"PIN · ":"";
    return pinned+origin+" · "+(score===undefined?"—":score.toFixed(3));
  };

  const phaseForRole=(roleId:RoleId)=>{
    return [...state.events].reverse().find(event=>event.roleId===roleId)?.phase;
  };

  const assignedRolesForSeat=(seatId:string)=>{
    return state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId.toUpperCase());
  };

  const stateForSeat=(seatId:SeatId):TerminalState=>{
    if(state.seatStatus[seatId]==="offline")return "offline";
    const roleIds=state.assignments.filter(item=>item.seatId===seatId).map(item=>item.roleId);
    if(roleIds.length===0)return "idle";
    const states=roleIds.map(roleId=>state.terminalStates[roleId]);
    return seatStatePriority.find(candidate=>states.includes(candidate))??"idle";
  };

  const emitInput=(input:ThinkTankEventInput)=>{
    const event=buildEvent(state,input);
    applyEvent(event);
  };

  const playInputs=(inputs:ThinkTankEventInput[])=>{
    if(playback.playing)return;
    const events=buildEventBatch(state,inputs);
    playback.play(events);
  };

  const runAutoRoute=()=>{
    playInputs(routingEventInputs(routingPreview));
  };

  const pinRole=(roleId:RoleId,seatId:SeatId)=>{
    if(playback.playing)return;
    const seat=seats.find(candidate=>candidate.id===seatId);
    if(!seat||state.seatStatus[seatId]==="offline")return;

    const score=scoreSeatForRole(roleId,seat,state,0);
    playInputs([
      {
        source:"operator",
        kind:"role.pinned",
        phase:"routing",
        roleId,
        seatId,
        message:"Operator pinned "+roleId.toUpperCase()+" to "+seatId.toUpperCase()+"."
      },
      {
        source:"system",
        kind:"role.assigned",
        phase:"routing",
        roleId,
        seatId,
        assignmentScore:score,
        assignmentOrigin:"operator-pin",
        assignmentReason:"Operator pin is authoritative; Crane Fly recorded the forced staffing assignment.",
        message:"Pinned staffing applied: "+roleId.toUpperCase()+" → "+seatId.toUpperCase()+"."
      }
    ]);
  };

  const unpinRole=(roleId:RoleId)=>{
    if(playback.playing||!state.pinnedAssignments[roleId])return;
    emitInput({
      source:"operator",
      kind:"role.unpinned",
      phase:"routing",
      roleId,
      message:"Operator removed pin from "+roleId.toUpperCase()+"."
    });
  };

  const setSeatStatus=(seatId:SeatId,seatStatus:SeatAvailability)=>{
    if(playback.playing||state.seatStatus[seatId]===seatStatus)return;
    emitInput({
      source:"operator",
      kind:"seat.status",
      phase:"routing",
      seatId,
      seatStatus,
      message:"Operator set "+seatId.toUpperCase()+" seat to "+seatStatus.toUpperCase()+"."
    });
  };

  const runScenario=(scenario:DemoScenario)=>{
    if(playback.playing)return;

    const targetMode:CollaborationMode=scenario==="council-gate-block"?"council":state.mode;
    const routePlan=planAssignments(state,seats,targetMode);
    if(routePlan.unresolved.length)return;

    const scenarioInputs=scenarioEventInputs(prompt,state.mode,scenario);
    const routeInputs=routingEventInputs(routePlan);
    const hasModePrefix=scenarioInputs[0]?.kind==="mode.selected";

    const inputs=hasModePrefix
      ?[scenarioInputs[0],...routeInputs,...scenarioInputs.slice(1)]
      :[...routeInputs,...scenarioInputs];

    playInputs(inputs);
    setPrompt("");
  };

  const selectMode=(mode:CollaborationMode)=>{
    if(playback.playing)return;
    emitInput({
      source:"operator",
      kind:"mode.selected",
      mode,
      phase:"intake",
      message:"Operator selected "+mode.toUpperCase()+" mode."
    });
  };

  const abort=()=>{
    playback.cancel();
    emitInput({
      source:"operator",
      kind:"session.aborted",
      phase:"aborted",
      message:"Operator abort. Session halted."
    });
  };

  const canForce=state.synthesisWithheld||Boolean(state.faultCode);

  const force=()=>{
    if(playback.playing||!canForce)return;
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
    if(playback.playing)return;
    const restored=replayEvents(createInitialState(),state.events);
    dispatch({type:"RESET",state:restored});
  };

  const focusRouter=()=>{
    document.getElementById("crane-fly-panel")?.scrollIntoView({behavior:motionMode==="full"?"smooth":"auto",block:"center"});
  };

  return <main
    className="room-shell"
    data-motion={motionMode}
    data-cue={cue.kind}
    data-seq={cue.seq}
  >
    <div className="scanlines" aria-hidden="true"/>
    <MotionLayer cue={cue} mode={motionMode}/>

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
        assignmentMeta={assignmentMeta(role.id)}
        phase={phaseForRole(role.id)}
        motionActive={cue.roleId===role.id}
        motionKind={cue.kind}
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
          availability={state.seatStatus[seat.id]}
          motionActive={cue.seatId===seat.id}
          motionKind={cue.kind}
        />)}
      </aside>

      <div className="center-stack">
        <Commonline
          assignments={state.assignments}
          activeRole={activeRole}
          seats={seats}
          cue={cue}
          motionMode={motionMode}
        />

        <CraneFlyPanel
          state={state}
          seats={seats}
          preview={routingPreview}
          busy={playback.playing}
          onAutoRoute={runAutoRoute}
          onPin={pinRole}
          onUnpin={unpinRole}
          onSeatStatus={setSeatStatus}
        />

        <GovernancePanel
          state={state}
          busy={playback.playing}
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
          canRun={routeReady}
          busy={playback.playing}
          onPrompt={setPrompt}
          onSend={()=>runScenario("happy")}
          onAbort={abort}
          onRouter={focusRouter}
          onForce={force}
        />

        <ModeBar mode={state.mode} disabled={playback.playing} onChange={selectMode}/>
      </div>

      <SystemStatus
        state={state}
        replayReport={replayReport}
        motionMode={motionMode}
        playing={playback.playing}
        routeReady={routeReady}
        unresolvedCount={routingPreview.unresolved.length}
      />
    </section>

    <LedgerRoll
      events={state.events}
      replayReport={replayReport}
      busy={playback.playing}
      onReplay={replayExact}
    />
  </main>;
}
