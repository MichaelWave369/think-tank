import type { RoleTerminal,Seat,TerminalState } from "../domain/types";

type RoleProps={
  kind:"role";
  terminal:RoleTerminal;
  state:TerminalState;
  utterance?:string;
  staffedBy:string;
  phase?:string;
};

type SeatProps={
  kind:"seat";
  terminal:Seat;
  assignedRoles:string[];
  state:TerminalState;
};

const stateSymbol:Record<TerminalState,string>={
  idle:"○",
  selected:"◆",
  listening:"◉",
  thinking:"≋",
  speaking:"▮▮▮",
  warning:"!",
  offline:"×",
  dimmed:"·"
};

function StateBeacon({state}:{state:TerminalState}){
  return <span className={"state-beacon state-beacon-"+state} aria-label={"Terminal state: "+state}>
    <b>{stateSymbol[state]}</b>
    <span>{state.toUpperCase()}</span>
  </span>;
}

export function TerminalPanel(props:RoleProps|SeatProps){
  if(props.kind==="seat"){
    const {terminal,assignedRoles,state}=props;
    return <section className={"terminal seat accent-"+terminal.accent+" state-"+state}>
      <header className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-dot"/>
          <span className="terminal-class">SEAT</span>
          <span>{terminal.name}</span>
        </div>
        <StateBeacon state={state}/>
      </header>

      <div className="terminal-visual seat-visual">
        <div>
          <small>PROVIDER / MODEL SUBSTRATE</small>
          <strong>{terminal.provider}</strong>
        </div>
        <div className="seat-binding">
          <small>CURRENT STAFFING</small>
          <span>{assignedRoles.length?assignedRoles.join(" · "):"UNASSIGNED"}</span>
        </div>
      </div>

      <div className="speech-window seat-window">
        <div className="speech-head">
          <strong>MODEL STATUS</strong>
          <span>{state.toUpperCase()}</span>
        </div>
        <p>{terminal.model==="unbound"?"Provider seat ready; model binding deferred to provider integration.":"MODEL: "+terminal.model}</p>
        <footer><span>SEAT {terminal.id.toUpperCase()}</span><span>NOT A COGNITIVE ROLE</span></footer>
      </div>

      <div className="meters">
        {Object.entries(terminal.capabilities).map(([key,value])=><div className="meter" key={key}>
          <span>{key}</span>
          <i style={{width:(value/5)*100+"%"}}/>
          <em>{value}/5</em>
        </div>)}
      </div>
    </section>;
  }

  const {terminal,state,utterance,staffedBy,phase}=props;
  const speaking=state==="speaking"||state==="warning";

  return <section className={"terminal role accent-"+terminal.accent+" state-"+state}>
    <header className="terminal-header">
      <div className="terminal-title">
        <span className="terminal-dot"/>
        <span className="terminal-class">ROLE</span>
        <span>{terminal.name}</span>
      </div>
      <StateBeacon state={state}/>
    </header>

    <div className="terminal-visual">
      <div className="motif">{terminal.motif}</div>
      <div className="verb-list">{terminal.verbs.map(v=><span key={v}>{v}</span>)}</div>
    </div>

    <div className="speech-window" aria-live={speaking?"polite":"off"}>
      <div className="speech-head">
        <strong>{speaking?"LIVE UTTERANCE":"LAST UTTERANCE"}</strong>
        <span>PHASE {(phase??"standby").toUpperCase()}</span>
      </div>
      <p>{utterance??"Standing by for operator input."}</p>
      <footer>
        <span>STAFFED BY {staffedBy}</span>
        <span>ROLE {terminal.id.toUpperCase()}</span>
      </footer>
    </div>
  </section>;
}
