import {useRef,useState} from "react";
import type { DossierTransparencyCheckpoint,DossierTransparencyWitnessReceipt,ThinkTankState } from "../domain/types";
import type { DossierPublicationStatusResponse,DossierRfc3161StatusResponse,DossierSealStatusResponse,DossierTransparencyStatusResponse } from "../providers/types";
import { latestDecisionDossier,overrideForDossier } from "../domain/decisionDossier";

const short=(value:string)=>value.replace("fnv1a32:","").slice(0,10)+"…";

const downloadJson=(filename:string,value:unknown)=>{
  const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  link.click();
  URL.revokeObjectURL(url);
};

const exportCheckpoint=(checkpoint:DossierTransparencyCheckpoint)=>{
  downloadJson(checkpoint.id.toLowerCase()+"-transparency-checkpoint.json",checkpoint);
};

const exportDossier=(state:ThinkTankState)=>{
  const dossier=latestDecisionDossier(state);
  if(!dossier)return;
  const override=overrideForDossier(state,dossier.id);
  const seals=state.dossierSeals.filter(item=>item.dossierId===dossier.id);
  const sealIds=new Set(seals.map(item=>item.id));
  const verifications=state.dossierSealVerifications.filter(item=>sealIds.has(item.sealId));
  const transparencyEntries=state.dossierTransparencyEntries.filter(item=>sealIds.has(item.sealId));
  const transparencyEntryIds=new Set(transparencyEntries.map(item=>item.id));
  const transparencyCheckpoints=state.dossierTransparencyCheckpoints.filter(item=>transparencyEntryIds.has(item.headEntryId));
  const checkpointIds=new Set(transparencyCheckpoints.map(item=>item.id));
  const witnesses=state.dossierTransparencyWitnesses.filter(item=>checkpointIds.has(item.checkpointId));
  const witnessIds=new Set(witnesses.map(item=>item.id));
  const witnessVerifications=state.dossierTransparencyWitnessVerifications.filter(item=>witnessIds.has(item.witnessId));
  const rfc3161Timestamps=state.dossierRfc3161Timestamps.filter(item=>checkpointIds.has(item.checkpointId));
  const checkpointPublications=state.dossierCheckpointPublications.filter(item=>checkpointIds.has(item.checkpointId));
  downloadJson(
    dossier.id.toLowerCase()+"-decision-dossier.json",
    {
      dossier,
      override,
      seals,
      verifications,
      transparencyEntries,
      transparencyCheckpoints,
      witnesses,
      witnessVerifications,
      rfc3161Timestamps,
      checkpointPublications
    }
  );
};

export function DecisionDossierPanel({
  state,
  sealStatus,
  transparencyStatus,
  rfc3161Status,
  publicationStatus,
  busy,
  sealBusy,
  transparencyBusy,
  checkpointBusy,
  witnessBusy,
  timestampBusy,
  publicationBusy,
  error,
  transparencyError,
  witnessError,
  timestampError,
  publicationError,
  onSeal,
  onVerify,
  onTransparencyAppend,
  onCheckpoint,
  onWitnessImport,
  onTimestamp,
  onPublish
}:{
  state:ThinkTankState;
  sealStatus:DossierSealStatusResponse|null;
  transparencyStatus:DossierTransparencyStatusResponse|null;
  rfc3161Status:DossierRfc3161StatusResponse|null;
  publicationStatus:DossierPublicationStatusResponse|null;
  busy:boolean;
  sealBusy:boolean;
  transparencyBusy:boolean;
  checkpointBusy:boolean;
  witnessBusy:boolean;
  timestampBusy:boolean;
  publicationBusy:boolean;
  error:string;
  transparencyError:string;
  witnessError:string;
  timestampError:string;
  publicationError:string;
  onSeal:(dossierId:string)=>void;
  onVerify:(dossierId:string,sealId:string)=>void;
  onTransparencyAppend:(dossierId:string,sealId:string)=>void;
  onCheckpoint:()=>void;
  onWitnessImport:(checkpointId:string,witness:DossierTransparencyWitnessReceipt)=>void;
  onTimestamp:(checkpointId:string)=>void;
  onPublish:(checkpointId:string)=>void;
}){
  const witnessFileRef=useRef<HTMLInputElement>(null);
  const [witnessImportError,setWitnessImportError]=useState("");
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
  const acceptedJournalHead=state.dossierTransparencyEntries[
    state.dossierTransparencyEntries.length-1
  ]??null;
  const isAcceptedJournalHead=Boolean(
    latestTransparency&&acceptedJournalHead?.id===latestTransparency.id
  );
  const latestCheckpoint=latestTransparency
    ?[...state.dossierTransparencyCheckpoints]
      .reverse()
      .find(item=>item.headEntryId===latestTransparency.id)??null
    :null;
  const latestWitness=latestCheckpoint
    ?[...state.dossierTransparencyWitnesses]
      .reverse()
      .find(item=>item.checkpointId===latestCheckpoint.id)??null
    :null;
  const latestWitnessVerification=latestWitness
    ?[...state.dossierTransparencyWitnessVerifications]
      .reverse()
      .find(item=>item.witnessId===latestWitness.id)??null
    :null;
  const latestTimestamp=latestCheckpoint
    ?[...state.dossierRfc3161Timestamps]
      .reverse()
      .find(item=>item.checkpointId===latestCheckpoint.id)??null
    :null;
  const timestampState=latestTimestamp
    ?"RFC3161 VERIFIED"
    :rfc3161Status?.state==="configured"
      ?"TSA READY"
      :rfc3161Status?.state==="error"
        ?"TSA ERROR"
        :"TSA DISABLED";
  const publications=latestCheckpoint
    ?state.dossierCheckpointPublications.filter(item=>item.checkpointId===latestCheckpoint.id)
    :[];
  const currentPublisherPublication=publicationStatus?.publisherUrl
    ?[...publications].reverse().find(item=>item.publisherUrl===publicationStatus.publisherUrl)??null
    :null;
  const latestPublication=publications[publications.length-1]??null;
  const publicationState=currentPublisherPublication
    ?"PUBLISHED · READ-BACK VERIFIED"
    :publicationStatus?.state==="configured"
      ?"PUBLISHER READY"
      :publicationStatus?.state==="error"
        ?"PUBLISHER ERROR"
        :"PUBLISHER DISABLED";

  const importWitnessFile=async(file:File|null)=>{
    if(!file||!latestCheckpoint)return;
    try{
      const parsed=JSON.parse(await file.text()) as DossierTransparencyWitnessReceipt;
      if(!parsed||typeof parsed!=="object")throw new Error("Witness file does not contain a JSON object.");
      setWitnessImportError("");
      onWitnessImport(latestCheckpoint.id,parsed);
    }catch(error){
      setWitnessImportError(error instanceof Error?error.message:String(error));
    }
  };

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

        <div className="dossier-checkpoint">
          <div className="dossier-transparency-head">
            <div>
              <small>PORTABLE HEAD CHECKPOINT</small>
              <strong>{latestCheckpoint?"FROZEN":"NOT FROZEN"}</strong>
            </div>
            <span>{latestCheckpoint?"#"+latestCheckpoint.entryCount:isAcceptedJournalHead?"HEAD READY":"LATEST DOSSIER IS NOT JOURNAL HEAD"}</span>
          </div>

          {latestCheckpoint
            ?<div className="dossier-seal-details">
              <p><b>Checkpoint</b> {latestCheckpoint.id}</p>
              <p><b>Checkpoint SHA-256</b> {latestCheckpoint.checkpointSha256}</p>
              <p><b>Journal head</b> {latestCheckpoint.headEntryId}</p>
              <p><b>Head SHA-256</b> {latestCheckpoint.headSha256}</p>
              <p><b>Clock</b> UNTRUSTED LOCAL CLOCK · {latestCheckpoint.createdAt}</p>
            </div>
            :<p>
              Freeze the current accepted journal head into a portable checkpoint before sending it to an independent witness.
            </p>}

          <div className="dossier-seal-actions">
            <button
              type="button"
              onClick={onCheckpoint}
              disabled={
                busy||
                checkpointBusy||
                !latestTransparency||
                !isAcceptedJournalHead||
                Boolean(latestCheckpoint)||
                transparencyStatus?.state!=="ready"
              }
            >
              {checkpointBusy?"FREEZING…":latestCheckpoint?"HEAD CHECKPOINTED":"FREEZE JOURNAL CHECKPOINT"}
            </button>
            <button
              type="button"
              onClick={()=>latestCheckpoint&&exportCheckpoint(latestCheckpoint)}
              disabled={!latestCheckpoint}
            >
              EXPORT CHECKPOINT
            </button>
          </div>

          <div className="dossier-witness">
            <div className="dossier-transparency-head">
              <div>
                <small>DETACHED EXTERNAL WITNESS</small>
                <strong>{latestWitnessVerification?.verified?"WITNESSED · VERIFIED":latestCheckpoint?"AWAITING WITNESS":"NO CHECKPOINT"}</strong>
              </div>
              <span>{latestWitness?.witnessLabel??"INDEPENDENT KEY REQUIRED"}</span>
            </div>

            {latestWitness
              ?<div className="dossier-seal-details">
                <p><b>Witness</b> {latestWitness.id}</p>
                <p><b>Key fingerprint</b> {latestWitness.publicKeyFingerprintSha256}</p>
                <p><b>Checkpoint SHA-256</b> {latestWitness.checkpointSha256}</p>
                <p><b>Claimed witness time</b> {latestWitness.witnessedAt}</p>
                <p><b>Trust</b> SELF-ATTESTED EXTERNAL WITNESS KEY</p>
                {latestWitnessVerification&&<p><b>Verified locally</b> {latestWitnessVerification.verifiedAt}</p>}
              </div>
              :<p>
                Export the checkpoint, sign it on an independent machine/key, then import only the detached witness JSON.
              </p>}

            {(witnessError||witnessImportError)&&<div className="dossier-seal-error">{witnessError||witnessImportError}</div>}

            <input
              ref={witnessFileRef}
              type="file"
              accept=".json,application/json"
              className="dossier-witness-file"
              onChange={event=>{
                const file=event.currentTarget.files?.[0]??null;
                void importWitnessFile(file);
                event.currentTarget.value="";
              }}
            />
            <div className="dossier-seal-actions">
              <button
                type="button"
                onClick={()=>witnessFileRef.current?.click()}
                disabled={busy||witnessBusy||!latestCheckpoint}
              >
                {witnessBusy?"VERIFYING WITNESS…":"IMPORT WITNESS RECEIPT"}
              </button>
            </div>
          </div>

          <div className={"dossier-timestamp "+(
            latestTimestamp?"timestamp-verified":
            rfc3161Status?.state==="error"?"timestamp-error":""
          )}>
            <div className="dossier-transparency-head">
              <div>
                <small>RFC 3161 TIMESTAMP AUTHORITY</small>
                <strong>{timestampState}</strong>
              </div>
              <span>{rfc3161Status?.standard??"RFC3161"} · {rfc3161Status?.hashAlgorithm??"SHA-256"}</span>
            </div>

            {latestTimestamp
              ?<div className="dossier-seal-details">
                <p><b>Timestamp</b> {latestTimestamp.id}</p>
                <p><b>TSA generation time</b> {latestTimestamp.genTime}</p>
                <p><b>Checkpoint SHA-256</b> {latestTimestamp.checkpointSha256}</p>
                <p><b>Token SHA-256</b> {latestTimestamp.tokenSha256}</p>
                <p><b>Policy OID</b> {latestTimestamp.tsaPolicyOid}</p>
                <p><b>Serial</b> {latestTimestamp.tsaSerialNumber}</p>
                <p><b>TSA subject</b> {latestTimestamp.tsaSubject}</p>
                <p><b>Authority</b> {latestTimestamp.authorityUrl}</p>
                <p><b>Trust anchor SHA-256</b> {latestTimestamp.trustAnchorSha256}</p>
                <p><b>Verified locally</b> {latestTimestamp.verifiedAt}</p>
                <p><b>Trust</b> CONFIGURED RFC3161 TRUST ANCHOR</p>
              </div>
              :<p>
                Request a standards-based timestamp token for this checkpoint. Verification is performed
                with OpenSSL against the operator-configured RFC 3161 trust anchor.
              </p>}

            {rfc3161Status?.detail&&<p className="dossier-tool-detail">{rfc3161Status.detail}</p>}
            {timestampError&&<div className="dossier-seal-error">{timestampError}</div>}

            <div className="dossier-seal-actions">
              <button
                type="button"
                onClick={()=>latestCheckpoint&&onTimestamp(latestCheckpoint.id)}
                disabled={
                  busy||
                  timestampBusy||
                  !latestCheckpoint||
                  Boolean(latestTimestamp)||
                  rfc3161Status?.state!=="configured"
                }
              >
                {timestampBusy
                  ?"REQUESTING TIMESTAMP…"
                  :latestTimestamp
                    ?"CHECKPOINT TIMESTAMPED"
                    :"REQUEST RFC3161 TIMESTAMP"}
              </button>
            </div>
          </div>

          <div className={"dossier-publication "+(
            currentPublisherPublication?"publication-verified":
            publicationStatus?.state==="error"?"publication-error":""
          )}>
            <div className="dossier-transparency-head">
              <div>
                <small>EXTERNAL CHECKPOINT PUBLICATION</small>
                <strong>{publicationState}</strong>
              </div>
              <span>
                {publications.length
                  ?String(publications.length)+" VERIFIED PUBLICATION"+(publications.length===1?"":"S")
                  :publicationStatus?.protocol??"phi-checkpoint-publication-v1"}
              </span>
            </div>

            {latestPublication
              ?<div className="dossier-seal-details">
                <p><b>Receipt</b> {latestPublication.id}</p>
                <p><b>Publication id</b> {latestPublication.publicationId}</p>
                <p><b>Checkpoint SHA-256</b> {latestPublication.checkpointSha256}</p>
                <p><b>Canonical payload SHA-256</b> {latestPublication.payloadSha256}</p>
                <p><b>Publisher</b> {latestPublication.publisherUrl}</p>
                <p><b>Retrieval URL</b> {latestPublication.retrievalUrl}</p>
                <p><b>Publisher-claimed time</b> {latestPublication.publisherClaimedAt}</p>
                <p><b>Read-back verified</b> {latestPublication.retrievalVerifiedAt}</p>
                <p><b>Receipt SHA-256</b> {latestPublication.receiptSha256}</p>
                <p><b>Trust</b> EXTERNALLY RETRIEVED PUBLICATION</p>
              </div>
              :<p>
                Publish this checkpoint through the configured external publisher. Acceptance requires
                a second HTTPS read-back of the exact canonical checkpoint from the configured public origin.
              </p>}

            {publicationStatus?.detail&&<p className="dossier-tool-detail">{publicationStatus.detail}</p>}
            {publicationError&&<div className="dossier-seal-error">{publicationError}</div>}

            <div className="dossier-seal-actions">
              <button
                type="button"
                onClick={()=>latestCheckpoint&&onPublish(latestCheckpoint.id)}
                disabled={
                  busy||
                  publicationBusy||
                  !latestCheckpoint||
                  Boolean(currentPublisherPublication)||
                  publicationStatus?.state!=="configured"
                }
              >
                {publicationBusy
                  ?"PUBLISHING + VERIFYING…"
                  :currentPublisherPublication
                    ?"CURRENT PUBLISHER VERIFIED"
                    :"PUBLISH + VERIFY CHECKPOINT"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer>
      <span>Integrity chain: dossier → seal → journal → checkpoint → witness / RFC3161 time / verified external publication. None of these provenance layers grants factual truth authority.</span>
      <button type="button" onClick={()=>exportDossier(state)}>TEAR / EXPORT DOSSIER</button>
    </footer>
  </section>;
}
