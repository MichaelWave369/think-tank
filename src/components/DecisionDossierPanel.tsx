import type { ThinkTankState } from "../domain/types";
import type { DossierSealStatusResponse,DossierTransparencyStatusResponse } from "../providers/types";
import { latestDecisionDossier,overrideForDossier } from "../domain/decisionDossier";

const short=(value:string)=>value.replace("fnv1a32:","").slice(0,10)+"…";

const exportDossier=(state:ThinkTankState)=>{
  const dossier=latestDecisionDossier(state);
  if(!dossier)return;
  const override=overrideForDossier(state,dossier.id);
  const seals=state.dossierSeals.filter(item=>item.dossierId===dossier.id);
  const sealIds=new Set(seals.map(item=>item.id));
  const verifications=state.dossierSealVerifications.filter(item=>sealIds.has(item.sealId));
  const transparencyEntries=state.dossierTransparencyEntries.filter(item=>sealIds.has(item.sealId));
  const blob=new Blob(
    [JSON.stringify({dossier,override,seals,verifications,transparencyEntries},null,2)],
    {type:"application/json;charset=utf-8"}
  );
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=dossier.id.toLowerCase()+"-decision-dossier.json";
  link.click();
  URL.revokeObjectURL(url);
};

export function DecisionDossierPanel({
  state,
  sealStatus,
  transparencyStatus,
  busy,
  sealBusy,
  transparencyBusy,
  error,
  transparencyError,
  onSeal,
  onVerify,
  onTransparencyAppend
}:{
  state:ThinkTankState;
  sealStatus:DossierSealStatusResponse|null;
  transparencyStatus:DossierTransparencyStatusResponse|null;
  busy:boolean;
  sealBusy:boolean;
  transparencyBusy:boolean;
  error:string;
  transparencyError:string;
  onSeal:(dossierId:string)=>void;
  onVerify:(dossierId:string,sealId:string)=>void;
  onTransparencyAppend:(dossierId:string,sealId:string)=>void;
}){
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

  const seals=state.dossierSeals.filter(item=>item.dossierId===dossier.id);
  const latestSeal=seals[seals.length-1]??null;
  const latestVerification=latestSeal
    ?[...state.dossierSealVerifications]
      .reverse()
      .find(item=>item.sealId===latestSeal.id)??null
    :null;
  const configuredSignerAlreadySealed=Boolean(
    sealStatus?.keyFingerprint&&
    seals.some(item=>item.publicKeyFingerprintSha256===sealStatus.keyFingerprint)
  );
  const sealState=!latestSeal
    ?"UNSEALED"
    :!latestVerification
      ?"SEALED · UNVERIFIED"
      :latestVerification.verified
        ?"VERIFIED"
        :"INVALID";
  const latestTransparency=latestSeal
    ?[...state.dossierTransparencyEntries]
      .reverse()
      .find(item=>item.sealId===latestSeal.id)??null
    :null;
  const transparencyState=!latestSeal
    ?"NO SEAL"
    :latestTransparency
      ?"LOGGED · VERIFIED AT APPEND"
      :transparencyStatus?.state==="corrupt"
        ?"JOURNAL CORRUPT"
        :transparencyStatus?.state==="ready"
          ?"READY"
          :"DISABLED";

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

    <div className={"dossier-seal "+(
      latestVerification?.verified?"seal-valid":
      latestVerification&&!latestVerification.verified?"seal-invalid":"seal-pending"
    )}>
      <div className="dossier-seal-head">
        <div>
          <small>CRYPTOGRAPHIC SEAL</small>
          <strong>{sealState}</strong>
        </div>
        <span>
          {sealStatus?.state==="configured"
            ?"SIGNER "+(sealStatus.signerLabel??"LOCAL")
            :"SIGNER DISABLED"}
        </span>
      </div>

      {latestSeal
        ?<div className="dossier-seal-details">
          <p><b>Seal</b> {latestSeal.id}</p>
          <p><b>Dossier SHA-256</b> {latestSeal.digestSha256}</p>
          <p><b>Key fingerprint</b> {latestSeal.publicKeyFingerprintSha256}</p>
          <p><b>Algorithm</b> {latestSeal.algorithm} · {latestSeal.canonicalization}</p>
          <p><b>Trust</b> SELF-ATTESTED LOCAL KEY · {latestSeal.signerLabel}</p>
          <p><b>Signed</b> {latestSeal.signedAt}</p>
          {latestVerification&&<p>
            <b>Verified</b> {latestVerification.verified?"VALID":"INVALID"} · {latestVerification.verifiedAt}
          </p>}
        </div>
        :<p>
          No cryptographic seal yet. The deterministic dossier remains valid replay state,
          but it has not been signed by a configured local key.
        </p>}

      {error&&<div className="dossier-seal-error">{error}</div>}

      <div className="dossier-seal-actions">
        <button
          type="button"
          onClick={()=>onSeal(dossier.id)}
          disabled={busy||sealStatus?.state!=="configured"||configuredSignerAlreadySealed}
        >
          {sealBusy
            ?"WORKING…"
            :configuredSignerAlreadySealed
              ?"CURRENT SIGNER ALREADY SEALED"
              :"SEAL DOSSIER"}
        </button>
        <button
          type="button"
          onClick={()=>latestSeal&&onVerify(dossier.id,latestSeal.id)}
          disabled={busy||!latestSeal}
        >
          VERIFY SEAL
        </button>
      </div>

      <div className={"dossier-transparency "+(
        latestTransparency?"transparency-logged":
        transparencyStatus?.state==="corrupt"?"transparency-corrupt":""
      )}>
        <div className="dossier-transparency-head">
          <div>
            <small>LOCAL TRANSPARENCY JOURNAL</small>
            <strong>{transparencyState}</strong>
          </div>
          <span>
            {transparencyStatus?.state==="ready"
              ?String(transparencyStatus.entryCount)+" ENTRIES"
              :transparencyStatus?.state?.toUpperCase()??"UNAVAILABLE"}
          </span>
        </div>

        {latestTransparency
          ?<div className="dossier-seal-details">
            <p><b>Entry</b> {latestTransparency.id} · #{latestTransparency.sequence}</p>
            <p><b>Entry SHA-256</b> {latestTransparency.entrySha256}</p>
            <p><b>Previous SHA-256</b> {latestTransparency.previousEntrySha256}</p>
            <p><b>Seal</b> {latestTransparency.sealId}</p>
            <p><b>Clock</b> UNTRUSTED LOCAL CLOCK · {latestTransparency.loggedAt}</p>
            <p><b>Trust</b> TAMPER-EVIDENT LOCAL JOURNAL</p>
          </div>
          :<p>
            A seal can be appended to the persistent local SHA-256 journal.
            This establishes hash-chain continuity, not trusted time or external identity.
          </p>}

        {transparencyError&&<div className="dossier-seal-error">{transparencyError}</div>}

        <div className="dossier-seal-actions">
          <button
            type="button"
            onClick={()=>latestSeal&&onTransparencyAppend(dossier.id,latestSeal.id)}
            disabled={
              busy||
              transparencyBusy||
              !latestSeal||
              Boolean(latestTransparency)||
              transparencyStatus?.state!=="ready"
            }
          >
            {transparencyBusy
              ?"APPENDING…"
              :latestTransparency
                ?"SEAL ALREADY LOGGED"
                :"APPEND SEAL TO JOURNAL"}
          </button>
        </div>
      </div>
    </div>

    <footer>
      <span>Normal dossier is immutable. Seal and transparency receipts add integrity evidence without adding truth authority.</span>
      <button type="button" onClick={()=>exportDossier(state)}>TEAR / EXPORT DOSSIER</button>
    </footer>
  </section>;
}
