import { useState } from "react";
import type { EvidenceRef,GateBreakdown } from "../domain/types";

const pct=(value:number)=>Math.round(value*100)+"%";

export function EvidencePanel({
  refs,
  breakdown,
  threshold,
  busy,
  onAdd,
  onRemove
}:{
  refs:EvidenceRef[];
  breakdown:GateBreakdown|null;
  threshold:number;
  busy:boolean;
  onAdd:(label:string,uri:string,note:string)=>void;
  onRemove:(id:string)=>void;
}){
  const [label,setLabel]=useState("");
  const [uri,setUri]=useState("");
  const [note,setNote]=useState("");

  const submit=()=>{
    if(!label.trim()||busy)return;
    onAdd(label.trim(),uri.trim(),note.trim());
    setLabel("");setUri("");setNote("");
  };

  return <section className="evidence-panel">
    <header>
      <div>
        <strong>REALITY GATE / EVIDENCE PACKET</strong>
        <span>PROVENANCE ≠ TRUTH · CONSENSUS ≠ EVIDENCE</span>
      </div>
      <b className={breakdown&&breakdown.finalScore>=threshold?"evidence-pass":"evidence-hold"}>
        {breakdown?breakdown.finalScore.toFixed(2):"UNSCORED"} / {threshold.toFixed(2)}
      </b>
    </header>

    <div className="evidence-entry">
      <label><span>LABEL</span><input value={label} onChange={e=>setLabel(e.target.value)} disabled={busy} placeholder="Primary source, field observation, benchmark…"/></label>
      <label><span>URI / REFERENCE</span><input value={uri} onChange={e=>setUri(e.target.value)} disabled={busy} placeholder="https://… or local reference"/></label>
      <label><span>NOTE</span><input value={note} onChange={e=>setNote(e.target.value)} disabled={busy} placeholder="What this reference supports"/></label>
      <button type="button" onClick={submit} disabled={busy||!label.trim()}>ADD OPERATOR-ATTESTED EVIDENCE</button>
    </div>

    <div className="evidence-list">
      {refs.length===0&&<p className="evidence-empty">No external evidence receipts. Model output alone is capped below the normal gate threshold.</p>}
      {refs.map(ref=><article key={ref.id}>
        <div>
          <strong>{ref.label}</strong>
          <span>{ref.id} · {ref.verification.toUpperCase()} · {ref.kind.toUpperCase()}</span>
          {ref.uri&&<small>{ref.uri}</small>}
          {ref.note&&<p>{ref.note}</p>}
        </div>
        <button type="button" onClick={()=>onRemove(ref.id)} disabled={busy}>REMOVE</button>
      </article>)}
    </div>

    {breakdown&&<div className="evidence-score-grid">
      <div><small>PROVENANCE</small><span>{pct(breakdown.provenance)}</span></div>
      <div><small>ROLE COVERAGE</small><span>{pct(breakdown.roleCoverage)}</span></div>
      <div><small>SEAT DIVERSITY</small><span>{pct(breakdown.seatDiversity)}</span></div>
      <div><small>CHALLENGE</small><span>{pct(breakdown.challengeCoverage)}</span></div>
      <div><small>EXTERNAL SUPPORT</small><span>{pct(breakdown.externalSupport)}</span></div>
      <div><small>RAW</small><span>{breakdown.rawScore.toFixed(2)}</span></div>
      <div><small>CAP</small><span>{breakdown.cap.toFixed(2)}</span></div>
      <div><small>FINAL</small><span>{breakdown.finalScore.toFixed(2)}</span></div>
    </div>}

    {breakdown&&<footer>
      <span>{breakdown.evidenceCount} external · {breakdown.attestedEvidenceCount} attested · {breakdown.verifiedEvidenceCount} machine-verified</span>
      <p>{breakdown.capReason}</p>
    </footer>}
  </section>;
}
