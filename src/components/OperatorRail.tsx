interface Props{
  sessionId:string;
  seed:string;
  prompt:string;
  canForce:boolean;
  busy:boolean;
  onPrompt:(value:string)=>void;
  onSend:()=>void;
  onAbort:()=>void;
  onForce:()=>void;
}

export function OperatorRail({sessionId,seed,prompt,canForce,busy,onPrompt,onSend,onAbort,onForce}:Props){
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
      <button onClick={onSend} disabled={busy}>SEND / RUN MODE</button>
      <button className="abort" onClick={onAbort}>ABORT</button>
      <button disabled={busy}>PIN / UNPIN</button>
      <button className="force" onClick={onForce} disabled={busy||!canForce}>FORCE SYNTHESIS</button>
    </div>
    <div className="operator-meta">
      <span>SESSION {sessionId}</span>
      <span>SEED {seed}</span>
      <span>PLAYBACK {busy?"ACTIVE":"IDLE"}</span>
      <span>FORCE {canForce&&!busy?"ARMED":"SAFE"}</span>
    </div>
  </section>;
}
