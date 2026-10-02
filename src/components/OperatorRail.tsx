interface Props{
  sessionId:string;
  seed:string;
  prompt:string;
  canForce:boolean;
  canRun:boolean;
  busy:boolean;
  onPrompt:(value:string)=>void;
  onSend:()=>void;
  onAbort:()=>void;
  onRouter:()=>void;
  onForce:()=>void;
}

export function OperatorRail({sessionId,seed,prompt,canForce,canRun,busy,onPrompt,onSend,onAbort,onRouter,onForce}:Props){
  return <section className="operator-rail">
    <div className="operator-label"><strong>OPERATOR</strong><span>HUMAN AUTHORITY</span></div>
    <textarea
      value={prompt}
      onChange={event=>onPrompt(event.target.value)}
      placeholder="Speak to the Think Tank…"
      rows={2}
      disabled={busy}
    />
    <div className="operator-actions">
      <button onClick={onSend} disabled={busy||!canRun}>RUN SIMULATION</button>
      <button className="abort" onClick={onAbort}>ABORT</button>
      <button onClick={onRouter} disabled={busy}>CRANE FLY / PIN</button>
      <button className="force" onClick={onForce} disabled={busy||!canForce}>FORCE SYNTHESIS</button>
    </div>
    <div className="operator-meta">
      <span>SESSION {sessionId}</span><span>SEED {seed}</span>
      <span>ROUTE {canRun?"READY":"BLOCKED"}</span>
      <span>PLAYBACK {busy?"ACTIVE":"IDLE"}</span>
      <span>FORCE {canForce&&!busy?"ARMED":"SAFE"}</span>
    </div>
  </section>;
}
