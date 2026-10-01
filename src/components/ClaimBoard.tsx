import { useMemo,useState } from "react";
import { claimStatusFromBindings } from "../domain/claims";
import type { Claim,ClaimBinding,ClaimRelation,EvidenceRef } from "../domain/types";

function ClaimCard({
  claim,
  bindings,
  evidence,
  busy,
  onRemove,
  onBind,
  onUnbind
}:{
  claim:Claim;
  bindings:ClaimBinding[];
  evidence:EvidenceRef[];
  busy:boolean;
  onRemove:(claimId:string)=>void;
  onBind:(claimId:string,evidenceId:string,relation:ClaimRelation,note:string)=>void;
  onUnbind:(bindingId:string)=>void;
}){
  const [evidenceId,setEvidenceId]=useState("");
  const [relation,setRelation]=useState<ClaimRelation>("supports");
  const [note,setNote]=useState("");

  const boundIds=useMemo(()=>new Set(bindings.map(binding=>binding.evidenceId)),[bindings]);
  const available=evidence.filter(ref=>!boundIds.has(ref.id));
  const status=claimStatusFromBindings(bindings);

  const bind=()=>{
    if(!evidenceId||busy)return;
    onBind(claim.id,evidenceId,relation,note.trim());
    setEvidenceId("");
    setNote("");
  };

  return <article className={"claim-card status-"+status}>
    <header>
      <div>
        <strong>{claim.id}</strong>
        <span>{claim.text}</span>
      </div>
      <div className="claim-head-actions">
        <b>{status.toUpperCase().replace("-"," ")}</b>
        <button type="button" onClick={()=>onRemove(claim.id)} disabled={busy||bindings.length>0}>REMOVE</button>
      </div>
    </header>

    <div className="claim-bindings">
      {bindings.length===0&&<p>NO EVIDENCE BINDINGS</p>}
      {bindings.map(binding=>{
        const ref=evidence.find(item=>item.id===binding.evidenceId);
        return <div className={"claim-binding relation-"+binding.relation} key={binding.id}>
          <div>
            <strong>{binding.relation.toUpperCase()}</strong>
            <span>{binding.id} · {ref?.id??binding.evidenceId} · {ref?.verification.toUpperCase()??"MISSING"}</span>
            <p>{ref?.label??"Evidence reference unavailable."}</p>
            {binding.note&&<small>{binding.note}</small>}
          </div>
          <button type="button" onClick={()=>onUnbind(binding.id)} disabled={busy}>UNBIND</button>
        </div>;
      })}
    </div>

    <div className="claim-binder">
      <label><span>EVIDENCE</span><select value={evidenceId} onChange={e=>setEvidenceId(e.target.value)} disabled={busy||available.length===0}>
        <option value="">SELECT RECEIPT</option>
        {available.map(ref=><option key={ref.id} value={ref.id}>{ref.id} · {ref.label}</option>)}
      </select></label>
      <label><span>RELATION</span><select value={relation} onChange={e=>setRelation(e.target.value as ClaimRelation)} disabled={busy}>
        <option value="supports">SUPPORTS</option>
        <option value="contradicts">CONTRADICTS</option>
        <option value="context">CONTEXT</option>
      </select></label>
      <label><span>BINDING NOTE</span><input value={note} onChange={e=>setNote(e.target.value)} disabled={busy} placeholder="Why this source bears on the claim"/></label>
      <button type="button" onClick={bind} disabled={busy||!evidenceId}>BIND SOURCE → CLAIM</button>
    </div>
  </article>;
}

export function ClaimBoard({
  claims,
  bindings,
  evidence,
  busy,
  onAdd,
  onRemove,
  onBind,
  onUnbind
}:{
  claims:Claim[];
  bindings:ClaimBinding[];
  evidence:EvidenceRef[];
  busy:boolean;
  onAdd:(text:string)=>void;
  onRemove:(claimId:string)=>void;
  onBind:(claimId:string,evidenceId:string,relation:ClaimRelation,note:string)=>void;
  onUnbind:(bindingId:string)=>void;
}){
  const [text,setText]=useState("");

  const add=()=>{
    const value=text.trim();
    if(!value||busy)return;
    onAdd(value);
    setText("");
  };

  return <section className="claim-board">
    <header className="claim-board-header">
      <div>
        <strong>CLAIM BOARD / SOURCE MAP</strong>
        <span>BINDINGS DESCRIBE RELATIONSHIP · THEY DO NOT DECLARE TRUTH</span>
      </div>
      <b>{claims.length} CLAIMS · {bindings.length} BINDINGS</b>
    </header>

    <div className="claim-entry">
      <label><span>CLAIM</span><input value={text} onChange={e=>setText(e.target.value)} disabled={busy} placeholder="A specific proposition the evidence can bear on"/></label>
      <button type="button" onClick={add} disabled={busy||!text.trim()}>ADD CLAIM</button>
    </div>

    <div className="claim-list">
      {claims.length===0&&<p className="claim-empty">No claims registered. Evidence remains provenance-tracked but semantically unbound.</p>}
      {claims.map(claim=><ClaimCard
        key={claim.id}
        claim={claim}
        bindings={bindings.filter(binding=>binding.claimId===claim.id)}
        evidence={evidence}
        busy={busy}
        onRemove={onRemove}
        onBind={onBind}
        onUnbind={onUnbind}
      />)}
    </div>
  </section>;
}
