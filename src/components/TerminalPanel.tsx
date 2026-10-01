import type { RoleTerminal,Seat,TerminalState } from "../domain/types";
type RoleProps={kind:"role";terminal:RoleTerminal;state:TerminalState;utterance?:string;staffedBy:string};
type SeatProps={kind:"seat";terminal:Seat;assignment:string};
export function TerminalPanel(props:RoleProps|SeatProps){
 if(props.kind==="seat"){
  const {terminal,assignment}=props;
  return <section className={"terminal seat accent-"+terminal.accent}>
   <header><span className="terminal-dot"/>{terminal.name}</header>
   <div className="terminal-visual seat-visual">SEAT / PROVIDER</div>
   <div className="speech-window"><strong>{terminal.provider}</strong><span>MODEL: {terminal.model}</span><span>ASSIGNED: {assignment}</span></div>
   <div className="meters">{Object.entries(terminal.capabilities).map(([key,value])=><div className="meter" key={key}><span>{key}</span><i style={{width:(value/5)*100+"%"}}/></div>)}</div>
  </section>;
 }
 const {terminal,state,utterance,staffedBy}=props;
 return <section className={"terminal role accent-"+terminal.accent+" state-"+state}>
  <header><span className="terminal-dot"/>{terminal.name}<small>{state.toUpperCase()}</small></header>
  <div className="terminal-visual"><div className="motif">{terminal.motif}</div><div className="verb-list">{terminal.verbs.map(v=><span key={v}>{v}</span>)}</div></div>
  <div className="speech-window"><strong>{state==="speaking"||state==="warning"?"● SPEAKING":"LAST UTTERANCE"}</strong><span>{utterance??"Standing by for operator input."}</span><small>STAFFED BY {staffedBy}</small></div>
 </section>;
}
