import type { RoleTerminal,Seat,SeatAvailability,TerminalState } from "../domain/types";
import type { MotionCueKind } from "../motion/motion";

type RoleProps={
  kind:"role";
  terminal:RoleTerminal;
  state:TerminalState;
  utterance?:string;
  staffedBy:string;
  assignmentMeta?:string;
  phase?:string;
  motionActive?:boolean;
  motionKind?:MotionCueKind;
};

type SeatProps={
  kind:"seat";
  terminal:Seat;
  assignedRoles:string[];
  state:TerminalState;
  availability:SeatAvailability;
  motionActive?:boolean;
  motionKind?:MotionCueKind;
};

const stateSymbol:Record<TerminalState,string>={
  idle:"○",selected:"◆",listening:"◉",thinking:"≋",speaking:"▮▮▮",
  warning:"!",offline:"×",dimmed:"·"
};

function StateBeacon({state}:{state:TerminalState}){
  return <span className={"state-beacon state-beacon-"+state} aria-label={"Terminal state: "+state}>
    <b>{stateSymbol[state]}</b><span>{state.toUpperCase()}</span>
  </span>;
}

export function TerminalPanel(props:RoleProps|SeatProps){
  if(props.kind==="seat"){
    const {terminal,assignedRoles,state,availability,motionActive=false,motionKind="idle"}=props;
    return <section
      className={"terminal seat accent-"+terminal.accent+" state-"+state+" availability-"+availability+(motionActive?" motion-hit cue-"+motionKind:"")}
      data-terminal={"seat:"+terminal.id}
    >
      <header className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-dot"/><span className="terminal-class">SEAT</span><span>{terminal.name}</span>
        </div>
        <StateBeacon state={state}/>
      </header>

      <div className="terminal-visual seat-visual">
        <div>
          <small>PROVIDER / MODEL SUBSTRATE</small>
          <strong>{terminal.provider}</strong>
          <span className="availability-label">{availability.toUpperCase()} · {terminal.locality.toUpperCase()}</span>
        </div>
        <div className="seat-binding">
          <small>CURRENT STAFFING</small>
          <span>{assignedRoles.length?assignedRoles.join(" · "):"UNASSIGNED"}</span>
        </div>
      </div>

      <div className="speech-window seat-window">
        <div className="speech-head"><strong>MODEL STATUS</strong><span>{state.toUpperCase()}</span></div>
        <p>{availability==="offline"
          ?"Seat unavailable. Crane Fly will not auto-assign active roles here."
          :terminal.model==="unbound"
            ?"Provider seat ready; model binding deferred to provider integration."
            :"MODEL: "+terminal.model}</p>
        <footer><span>SEAT {terminal.id.toUpperCase()}</span><span>{availability.toUpperCase()}</span></footer>
      </div>

      <div className="meters">
        {Object.entries(terminal.capabilities).map(([key,value])=><div className="meter" key={key}>
          <span>{key}</span><i style={{width:(value/5)*100+"%"}}/><em>{value}/5</em>
        </div>)}
      </div>
    </section>;
  }

  const {terminal,state,utterance,staffedBy,assignmentMeta,phase,motionActive=false,motionKind="idle"}=props;
  const speaking=state==="speaking"||state==="warning";

  return <section
    className={"terminal role accent-"+terminal.accent+" state-"+state+(motionActive?" motion-hit cue-"+motionKind:"")}
    data-terminal={"role:"+terminal.id}
  >
    <header className="terminal-header">
      <div className="terminal-title">
        <span className="terminal-dot"/><span className="terminal-class">ROLE</span><span>{terminal.name}</span>
      </div>
      <StateBeacon state={state}/>
    </header>

    <div className="terminal-visual">
      <div className="motif">{terminal.motif}</div>
      <div className="verb-list">{terminal.verbs.map(value=><span key={value}>{value}</span>)}</div>
    </div>

    <div className="speech-window" aria-live={speaking?"polite":"off"}>
      <div className="speech-head">
        <strong>{speaking?"LIVE UTTERANCE":"LAST UTTERANCE"}</strong>
        <span>PHASE {(phase??"standby").toUpperCase()}</span>
      </div>
      <p>{utterance??"Standing by for operator input."}</p>
      <footer>
        <span>STAFFED BY {staffedBy}</span>
        <span>{assignmentMeta??("ROLE "+terminal.id.toUpperCase())}</span>
      </footer>
    </div>
  </section>;
}
