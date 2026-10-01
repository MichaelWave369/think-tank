import type { ThinkTankState } from "../domain/types";
import { latestDecisionDossier,overrideForDossier } from "../domain/decisionDossier";

const short=(value:string)=>value.replace("fnv1a32:","").slice(0,10)+"…";

const exportDossier=(state:ThinkTankState)=>{
  const dossier=latestDecisionDossier(state);
  if(!dossier)return;
  const override=overrideForDossier(state,dossier.id);
  const blob=new Blob(
    [JSON.stringify({dossier,override},null,2)],
    {type:"application/json;charset=utf-8"}
  );
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=dossier.id.toLowerCase()+"-decision-dossier.json";
  link.click();
  URL.revokeObjectURL(url);
};

export function DecisionDossierPanel({state}:{state:ThinkTankState}){
  const dossier=latestDecisionDossier(state);

  if(!dossier){
    return <section className="decision-dossier-panel dossier-empty">
      <header>
        <div>
          <strong>DECISION DOSSIER</strong>
          <span>NORMAL SYNTHESIS RECEIPT · IMMUTABLE BASIS SNAPSHOT</span>
        </div>
        <b>AWAITING DECISION</b>
      </header>
      <p>No completed or withheld synthesis has produced a dossier yet.</p>
    </section>;
  }

  const override=overrideForDossier(state,dossier.id);
  const claimPass=dossier.claimGovernance.passed;
  const argumentPass=dossier.argumentGovernance.passed;

  return <section className="decision-dossier-panel">
    <header>
      <div>
        <strong>DECISION DOSSIER · {dossier.id}</strong>
        <span>SEQ {dossier.decisionSeq} · {dossier.mode.toUpperCase()} · BASIS {short(dossier.basisFingerprint)}</span>
      </div>
      <b className={dossier.outcome==="completed"?"dossier-pass":"dossier-block"}>
        {dossier.outcome.toUpperCase()}
      </b>
    </header>

    <div className="dossier-grid">
      <div><small>OUTPUT</small><span>{dossier.outputLabel}</span></div>
      <div><small>NORMAL ACTION</small><span>{dossier.actionAllowed?"AUTHORIZED":"LOCKED"}</span></div>
      <div><small>REALITY GATE</small><span>{dossier.gateScore.toFixed(2)} / {dossier.gateThreshold.toFixed(2)}</span></div>
      <div><small>CLAIM POLICY</small><span>{claimPass?"PASS":"BLOCK"}</span></div>
      <div><small>ARGUMENT POLICY</small><span>{argumentPass?"PASS":"BLOCK"}</span></div>
      <div><small>OBJECTIONS</small><span>{dossier.objectionCount}</span></div>
      <div><small>CLAIMS</small><span>{dossier.claims.length}</span></div>
      <div><small>BINDINGS</small><span>{dossier.bindings.length}</span></div>
      <div><small>EVIDENCE</small><span>{dossier.evidence.length}</span></div>
      <div><small>EXCERPTS</small><span>{dossier.excerpts.length}</span></div>
      <div><small>STRUCTURAL REVIEWS</small><span>{dossier.claimReviews.length}</span></div>
      <div><small>ARGUMENT MAPS</small><span>{dossier.argumentReviews.length}</span></div>
      <div><small>PROVIDER TURNS</small><span>{dossier.providerTurns.length}</span></div>
      <div><small>FAULT</small><span>{dossier.faultCode||"NONE"}</span></div>
    </div>

    <div className="dossier-reason">
      <small>NORMAL GOVERNANCE DECISION</small>
      <p>{dossier.governanceReason}</p>
    </div>

    <div className="dossier-provider-turns">
      <small>CURRENT RUN PROVIDER PROVENANCE</small>
      {dossier.providerTurns.length===0
        ?<p>No provider turns were part of this decision basis.</p>
        :<ul>{dossier.providerTurns.map(turn=><li key={turn.seq}>
          #{turn.seq} · {turn.roleId.toUpperCase()} ← {turn.seatId.toUpperCase()} · {turn.providerModel||"MODEL UNRECORDED"}
          {turn.providerRequestId?" · "+turn.providerRequestId:""}
        </li>)}</ul>}
    </div>

    <div className={"dossier-override "+(override?"has-override":"no-override")}>
      <small>HUMAN OVERRIDE</small>
      {override
        ?<>
          <strong>{override.id} → {override.dossierId}</strong>
          <p>{override.reason}</p>
          <span>{override.outputLabel} · ACTION AUTHORIZED</span>
        </>
        :<p>None. Normal governance receipt remains controlling.</p>}
    </div>

    <footer>
      <span>Normal dossier is immutable. Override, if any, is a separate linked operator receipt.</span>
      <button type="button" onClick={()=>exportDossier(state)}>TEAR / EXPORT DOSSIER</button>
    </footer>
  </section>;
}
