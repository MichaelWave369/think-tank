interface Props{sessionId:string;seed:string;prompt:string;onPrompt:(v:string)=>void;onSend:()=>void;onAbort:()=>void;onForce:()=>void;}
export function OperatorRail({sessionId,seed,prompt,onPrompt,onSend,onAbort,onForce}:Props){
 return <section className="operator-rail">
  <div className="operator-label"><strong>OPERATOR</strong><span>HUMAN AUTHORITY</span></div>
  <textarea value={prompt} onChange={e=>onPrompt(e.target.value)} placeholder="Speak to the Think Tank…" rows={2}/>
  <div className="operator-actions"><button onClick={onSend}>SEND</button><button className="abort" onClick={onAbort}>ABORT</button><button>PIN / UNPIN</button><button className="force" onClick={onForce}>FORCE SYNTHESIS</button></div>
  <div className="operator-meta"><span>SESSION {sessionId}</span><span>SEED {seed}</span></div>
 </section>;
}
