import { useCallback,useEffect,useMemo,useReducer,useRef,useState } from "react";
import { roles,seats } from "../data/terminals";
import { planAssignments,routingEventInputs,scoreSeatForRole } from "../domain/craneFly";
import { projectEvent,thinkTankReducer } from "../domain/reducer";
import { createInitialState } from "../domain/state";
import type {
  CollaborationMode,
  EvidenceRef,
  RoleId,
  SeatAvailability,
  SeatId,
  TerminalState,
  ThinkTankEvent,
  ThinkTankEventInput,
  ThinkTankState
} from "../domain/types";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "../kernel/eventKernel";
import { deriveMotionCue } from "../motion/motion";
import { useEventPlayback } from "../motion/useEventPlayback";
import { useMotionPolicy } from "../motion/useMotionPolicy";
import { fetchMachineEvidence,fetchProviderStatus,invokeProvider } from "../providers/client";
import { runLiveProviderSession } from "../providers/liveRunner";
import type { ProviderStatusResponse } from "../providers/types";
import { scenarioEventInputs,type DemoScenario } from "../sim/demo";
import { TerminalPanel } from "./TerminalPanel";
import { Commonline } from "./Commonline";
import { CraneFlyPanel } from "./CraneFlyPanel";
import { EvidencePanel } from "./EvidencePanel";
import { GovernancePanel } from "./GovernancePanel";
import { OperatorRail } from "./OperatorRail";
import { ModeBar } from "./ModeBar";
import { MotionLayer } from "./MotionLayer";
import { ProviderPanel } from "./ProviderPanel";
import { SystemStatus } from "./SystemStatus";
import { LedgerRoll } from "./LedgerRoll";

const seatStatePriority:TerminalState[]=["warning","speaking","thinking","selected","listening","idle","dimmed","offline"];

export function ThinkTankRoom(){
  const [state,dispatch]=useReducer(thinkTankReducer,createInitialState());
  const stateRef=useRef<ThinkTankState>(state);
  stateRef.current=state;

  const [prompt,setPrompt]=useState("");
  const [providerStatus,setProviderStatus]=useState<ProviderStatusResponse|null>(null);
  const [providerError,setProviderError]=useState("");
  const [localModel,setLocalModel]=useState("");
  const [liveRunning,setLiveRunning]=useState(false);
  const [evidenceFetching,setEvidenceFetching]=useState(false);
  const [evidenceToolError,setEvidenceToolError]=useState("");
  const liveAbortRef=useRef<AbortController|null>(null);
  const evidenceAbortRef=useRef<AbortController|null>(null);
  const motionMode=useMotionPolicy();

  const applyEvent=useCallback((event:ThinkTankEvent)=>{
    stateRef.current=projectEvent(stateRef.current,event);
    dispatch({type:"APPLY_EVENT",event});
  },[]);

  const playback=useEventPlayback(applyEvent,motionMode);
  const busy=playback.playing||liveRunning||evidenceFetching;

  const refreshProviders=useCallback(async()=>{
    try{
      const next=await fetchProviderStatus();
      setProviderStatus(next);
      setProviderError("");
      const local=next.seats.find(seat=>seat.seatId==="local");
      setLocalModel(current=>
        current&&local?.models.includes(current)
          ?current
          :(local?.model||local?.models[0]||"")
      );
    }catch(error){
      setProviderStatus(null);
      setProviderError(error instanceof Error?error.message:String(error));
    }
  },[]);

  useEffect(()=>{
    void refreshProviders();
  },[refreshProviders]);

  const latestEvent=state.events[state.events.length-1];
  const cue=useMemo(()=>deriveMotionCue(latestEvent,state),[latestEvent,state]);

  const routingPreview=useMemo(
    ()=>planAssignments(state,seats,state.mode),
    [state]
  );
  const routeReady=routingPreview.unresolved.length===0;

  const liveReady=useMemo(()=>{
    if(!providerStatus||!routeReady)return false;

    return routingPreview.decisions.every(decision=>{
      const provider=providerStatus.seats.find(item=>item.seatId===decision.seatId);
      if(!provider)return false;
      if(decision.seatId==="local"){
        return provider.state==="connected"&&Boolean(localModel);
      }
      return provider.state==="configured"||provider.state==="connected";
    });
  },[providerStatus,routeReady,routingPreview,localModel]);

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
    const base=stateRef.current;
    const event=buildEvent(base,input);
    applyEvent(event);
  };

  const playInputs=(inputs:ThinkTankEventInput[])=>{
    if(busy)return;
    const events=buildEventBatch(stateRef.current,inputs);
    playback.play(events);
  };

  const addEvidence=(label:string,uri:string,note:string)=>{
    if(busy)return;
    const evidenceRef:EvidenceRef={
      id:"EV-"+String(stateRef.current.seq+1).padStart(4,"0"),
      kind:"operator-reference",
      verification:"operator-attested",
      label,
      uri:uri||undefined,
      note:note||undefined,
      addedBy:"operator"
    };
    emitInput({
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef,
      message:"Operator attested evidence "+evidenceRef.id+": "+label+"."
    });
  };

  const verifyEvidence=async(label:string,uri:string,note:string)=>{
    if(busy)return;

    const controller=new AbortController();
    evidenceAbortRef.current=controller;
    setEvidenceFetching(true);
    setEvidenceToolError("");

    emitInput({
      source:"operator",
      kind:"evidence.fetch.requested",
      phase:"intake",
      evidenceUri:uri,
      message:"Operator requested machine verification of "+uri+"."
    });

    try{
      const receipt=await fetchMachineEvidence(uri,controller.signal);
      const {ok:_,...retrieval}=receipt;
      const evidenceRef:EvidenceRef={
        id:"EV-"+String(stateRef.current.seq+1).padStart(4,"0"),
        kind:"external-source",
        verification:"machine-verified",
        label,
        uri:receipt.finalUri,
        note:note||undefined,
        retrieval,
        addedBy:"tool"
      };

      emitInput({
        source:"tool",
        kind:"evidence.added",
        phase:"intake",
        evidenceUri:uri,
        evidenceRef,
        message:
          "URL retrieval verified "+evidenceRef.id+
          " · SHA-256 "+receipt.sha256.slice(0,16)+"… · "+receipt.bytes+" bytes."
      });
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      setEvidenceToolError(message);

      try{
        emitInput({
          source:"tool",
          kind:"evidence.fetch.failed",
          phase:"intake",
          evidenceUri:uri,
          message:"Evidence retrieval failed: "+message
        });
      }catch{}
    }finally{
      evidenceAbortRef.current=null;
      setEvidenceFetching(false);
    }
  };

  const removeEvidence=(evidenceId:string)=>{
    if(busy)return;
    emitInput({
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId,
      message:"Operator removed evidence "+evidenceId+"."
    });
  };

  const runAutoRoute=()=>playInputs(routingEventInputs(routingPreview));

  const pinRole=(roleId:RoleId,seatId:SeatId)=>{
    if(busy)return;
    const seat=seats.find(candidate=>candidate.id===seatId);
    if(!seat||state.seatStatus[seatId]==="offline")return;

    const score=scoreSeatForRole(roleId,seat,state,0);
    playInputs([
      {
        source:"operator",kind:"role.pinned",phase:"routing",roleId,seatId,
        message:"Operator pinned "+roleId.toUpperCase()+" to "+seatId.toUpperCase()+"."
      },
      {
        source:"system",kind:"role.assigned",phase:"routing",roleId,seatId,
        assignmentScore:score,assignmentOrigin:"operator-pin",
        assignmentReason:"Operator pin is authoritative; Crane Fly recorded the forced staffing assignment.",
        message:"Pinned staffing applied: "+roleId.toUpperCase()+" → "+seatId.toUpperCase()+"."
      }
    ]);
  };

  const unpinRole=(roleId:RoleId)=>{
    if(busy||!state.pinnedAssignments[roleId])return;
    emitInput({
      source:"operator",kind:"role.unpinned",phase:"routing",roleId,
      message:"Operator removed pin from "+roleId.toUpperCase()+"."
    });
  };

  const setSeatStatus=(seatId:SeatId,seatStatus:SeatAvailability)=>{
    if(busy||state.seatStatus[seatId]===seatStatus)return;
    emitInput({
      source:"operator",kind:"seat.status",phase:"routing",seatId,seatStatus,
      message:"Operator set "+seatId.toUpperCase()+" seat to "+seatStatus.toUpperCase()+"."
    });
  };

  const syncProviderHealth=()=>{
    if(busy||!providerStatus)return;
    const inputs:ThinkTankEventInput[]=providerStatus.seats
      .map(provider=>{
        const seatStatus:SeatAvailability=
          provider.state==="connected"||provider.state==="configured"?"online":"offline";
        return {provider,seatStatus};
      })
      .filter(({provider,seatStatus})=>state.seatStatus[provider.seatId]!==seatStatus)
      .map(({provider,seatStatus})=>({
        source:"operator" as const,
        kind:"seat.status" as const,
        phase:"routing" as const,
        seatId:provider.seatId,
        seatStatus,
        message:"Operator synced "+provider.seatId.toUpperCase()+" to "+seatStatus.toUpperCase()+" from provider bridge health."
      }));

    if(inputs.length)playInputs(inputs);
  };

  const runScenario=(scenario:DemoScenario)=>{
    if(busy)return;

    const targetMode:CollaborationMode=scenario==="council-gate-block"?"council":state.mode;
    const routePlan=planAssignments(state,seats,targetMode);
    if(routePlan.unresolved.length)return;

    const scenarioInputs=scenarioEventInputs(prompt,state.mode,scenario);
    const routeInputs=routingEventInputs(routePlan);
    const hasModePrefix=scenarioInputs[0]?.kind==="mode.selected";

    const inputs=hasModePrefix
      ?[scenarioInputs[0],scenarioInputs[1],...routeInputs,...scenarioInputs.slice(2)]
      :[scenarioInputs[0],...routeInputs,...scenarioInputs.slice(1)];

    playInputs(inputs);
    setPrompt("");
  };

  const runLive=async()=>{
    if(busy||!liveReady)return;

    const controller=new AbortController();
    liveAbortRef.current=controller;
    setLiveRunning(true);
    setProviderError("");
    const livePrompt=prompt;
    setPrompt("");

    try{
      const result=await runLiveProviderSession({
        initialState:stateRef.current,
        seats,
        prompt:livePrompt,
        localModel,
        signal:controller.signal,
        invoke:invokeProvider,
        apply:applyEvent
      });

      if(result.error&&!result.aborted)setProviderError(result.error);
    }finally{
      liveAbortRef.current=null;
      setLiveRunning(false);
      void refreshProviders();
    }
  };

  const selectMode=(mode:CollaborationMode)=>{
    if(busy)return;
    emitInput({
      source:"operator",kind:"mode.selected",mode,phase:"intake",
      message:"Operator selected "+mode.toUpperCase()+" mode."
    });
  };

  const abort=()=>{
    const sessionActive=liveRunning||playback.playing;
    evidenceAbortRef.current?.abort();
    liveAbortRef.current?.abort();
    playback.cancel();
    setLiveRunning(false);

    if(sessionActive){
      emitInput({
        source:"operator",kind:"session.aborted",phase:"aborted",
        message:"Operator abort. Session halted."
      });
    }
  };

  const canForce=state.synthesisWithheld||Boolean(state.faultCode);

  const force=()=>{
    if(busy||!canForce)return;
    emitInput({
      source:"operator",kind:"operator.override",phase:"synthesis",override:true,
      outputLabel:state.mode==="audit"?"AUDIT":"STANDARD",actionAllowed:true,
      governanceReason:"Human operator explicitly overrode the withheld/faulted synthesis state.",
      message:"Operator override recorded: FORCE SYNTHESIS."
    });
  };

  const replayExact=()=>{
    if(busy)return;
    const restored=replayEvents(createInitialState(),state.events);
    stateRef.current=restored;
    dispatch({type:"RESET",state:restored});
  };

  const focusRouter=()=>{
    document.getElementById("crane-fly-panel")?.scrollIntoView({
      behavior:motionMode==="full"?"smooth":"auto",block:"center"
    });
  };

  return <main className="room-shell" data-motion={motionMode} data-cue={cue.kind} data-seq={cue.seq}>
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
        <Commonline assignments={state.assignments} activeRole={activeRole} seats={seats} cue={cue} motionMode={motionMode}/>

        <CraneFlyPanel
          state={state}
          seats={seats}
          preview={routingPreview}
          busy={busy}
          onAutoRoute={runAutoRoute}
          onPin={pinRole}
          onUnpin={unpinRole}
          onSeatStatus={setSeatStatus}
        />

        <ProviderPanel
          status={providerStatus}
          error={providerError}
          localModel={localModel}
          liveBusy={liveRunning}
          liveReady={liveReady}
          onLocalModel={setLocalModel}
          onRefresh={()=>void refreshProviders()}
          onSync={syncProviderHealth}
          onRunLive={()=>void runLive()}
        />

        <EvidencePanel
          refs={state.evidenceRefs}
          breakdown={state.gateBreakdown}
          threshold={state.gateThreshold}
          busy={busy}
          verifyBusy={evidenceFetching}
          verifyError={evidenceToolError}
          onAdd={addEvidence}
          onVerify={(label,uri,note)=>void verifyEvidence(label,uri,note)}
          onRemove={removeEvidence}
        />

        <GovernancePanel
          state={state}
          busy={busy}
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
          busy={busy}
          onPrompt={setPrompt}
          onSend={()=>runScenario("happy")}
          onAbort={abort}
          onRouter={focusRouter}
          onForce={force}
        />

        <ModeBar mode={state.mode} disabled={busy} onChange={selectMode}/>
      </div>

      <SystemStatus
        state={state}
        replayReport={replayReport}
        motionMode={motionMode}
        playing={busy}
        routeReady={routeReady}
        unresolvedCount={routingPreview.unresolved.length}
      />
    </section>

    <LedgerRoll events={state.events} replayReport={replayReport} busy={busy} onReplay={replayExact}/>
  </main>;
}
