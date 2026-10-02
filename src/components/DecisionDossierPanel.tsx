import {useRef,useState} from "react";
import type { DossierReleaseManifest,DossierTransparencyCheckpoint,DossierTransparencyWitnessReceipt,ProvenanceAssurancePolicyKind,ThinkTankState } from "../domain/types";
import type { DossierPublicationStatusResponse,DossierReleasePublicationStatusResponse,DossierReleaseSealStatusResponse,DossierRfc3161StatusResponse,DossierSealStatusResponse,DossierTransparencyStatusResponse } from "../providers/types";
import { latestDecisionDossier,overrideForDossier } from "../domain/decisionDossier";
import {
  PROVENANCE_ASSURANCE_POLICIES,
  PROVENANCE_ASSURANCE_POLICY_LABELS,
  PROVENANCE_ASSURANCE_REQUIREMENT_LABELS,
  provenanceAssuranceIsFresh
} from "../domain/provenanceAssurance";
import {releaseManifestIsCurrent} from "../domain/releaseManifest";
import {
  buildDossierReleasePackage,
  releasePackageBasisFingerprint,
  releasePackageHasVerifiedSeal
} from "../domain/releasePackage";

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

const exportReleasePackage=(state:ThinkTankState,manifest:DossierReleaseManifest)=>{
  downloadJson(
    manifest.id.toLowerCase()+"-release-package.json",
    buildDossierReleasePackage(state,manifest.id)
  );
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
  const provenanceAssurances=state.dossierProvenanceAssurances.filter(item=>item.dossierId===dossier.id);
  const releaseManifests=state.dossierReleaseManifests.filter(item=>item.dossierId===dossier.id);
  const releaseIds=new Set(releaseManifests.map(item=>item.id));
  const releaseSeals=state.dossierReleaseSeals.filter(item=>releaseIds.has(item.releaseId));
  const releaseSealIds=new Set(releaseSeals.map(item=>item.id));
  const releaseSealVerifications=state.dossierReleaseSealVerifications
    .filter(item=>releaseSealIds.has(item.sealId));
  const releaseRfc3161Timestamps=state.dossierReleaseRfc3161Timestamps
    .filter(item=>releaseSealIds.has(item.sealId));
  const releasePublications=state.dossierReleasePublications
    .filter(item=>releaseIds.has(item.releaseId));
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
      checkpointPublications,
      provenanceAssurances,
      releaseManifests,
      releaseSeals,
      releaseSealVerifications,
      releaseRfc3161Timestamps,
      releasePublications
    }
  );
};

export function DecisionDossierPanel({
  state,
  sealStatus,
  transparencyStatus,
  rfc3161Status,
  publicationStatus,
  releaseSealStatus,
  releasePublicationStatus,
  busy,
  sealBusy,
  transparencyBusy,
  checkpointBusy,
  witnessBusy,
  timestampBusy,
  publicationBusy,
  releaseSealBusy,
  releaseVerifyBusy,
  releaseTimestampBusy,
  releasePublicationBusy,
  error,
  transparencyError,
  witnessError,
  timestampError,
  publicationError,
  releaseSealError,
  releaseTimestampError,
  releasePublicationError,
  onSeal,
  onVerify,
  onTransparencyAppend,
  onCheckpoint,
  onWitnessImport,
  onTimestamp,
  onPublish,
  onAssurance,
  onRelease,
  onReleaseSeal,
  onReleaseVerify,
  onReleaseTimestamp,
  onReleasePublish
}:{
  state:ThinkTankState;
  sealStatus:DossierSealStatusResponse|null;
  transparencyStatus:DossierTransparencyStatusResponse|null;
  rfc3161Status:DossierRfc3161StatusResponse|null;
  publicationStatus:DossierPublicationStatusResponse|null;
  releaseSealStatus:DossierReleaseSealStatusResponse|null;
  releasePublicationStatus:DossierReleasePublicationStatusResponse|null;
  busy:boolean;
  sealBusy:boolean;
  transparencyBusy:boolean;
  checkpointBusy:boolean;
  witnessBusy:boolean;
  timestampBusy:boolean;
  publicationBusy:boolean;
  releaseSealBusy:boolean;
  releaseVerifyBusy:boolean;
  releaseTimestampBusy:boolean;
  releasePublicationBusy:boolean;
  error:string;
  transparencyError:string;
  witnessError:string;
  timestampError:string;
  publicationError:string;
  releaseSealError:string;
  releaseTimestampError:string;
  releasePublicationError:string;
  onSeal:(dossierId:string)=>void;
  onVerify:(dossierId:string,sealId:string)=>void;
  onTransparencyAppend:(dossierId:string,sealId:string)=>void;
  onCheckpoint:()=>void;
  onWitnessImport:(checkpointId:string,witness:DossierTransparencyWitnessReceipt)=>void;
  onTimestamp:(checkpointId:string)=>void;
  onPublish:(checkpointId:string)=>void;
  onAssurance:(dossierId:string,policy:ProvenanceAssurancePolicyKind)=>void;
  onRelease:(dossierId:string,policy:ProvenanceAssurancePolicyKind,assuranceReportId:string)=>void;
  onReleaseSeal:(releaseId:string)=>void;
  onReleaseVerify:(releaseId:string,sealId:string)=>void;
  onReleaseTimestamp:(releaseId:string,sealId:string)=>void;
  onReleasePublish:(releaseId:string)=>void;
}){
  const witnessFileRef=useRef<HTMLInputElement>(null);
  const [witnessImportError,setWitnessImportError]=useState("");
  const [assurancePolicy,setAssurancePolicy]=useState<ProvenanceAssurancePolicyKind>("full-provenance");
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
  const assuranceReports=state.dossierProvenanceAssurances.filter(item=>
    item.dossierId===dossier.id&&item.policy===assurancePolicy
  );
  const currentAssurance=assuranceReports[assuranceReports.length-1]??null;
  const assuranceFresh=currentAssurance
    ?provenanceAssuranceIsFresh(state,currentAssurance)
    :false;
  const currentRelease=currentAssurance
    ?[...state.dossierReleaseManifests]
      .reverse()
      .find(item=>
        item.dossierId===dossier.id&&
        item.policy===assurancePolicy&&
        item.assuranceReportId===currentAssurance.id
      )??null
    :null;
  const releaseCurrent=currentRelease
    ?releaseManifestIsCurrent(state,currentRelease)
    :false;
  const releaseState=currentRelease
    ?releaseCurrent?"RELEASE AUTHORIZED":"HISTORICAL RELEASE"
    :currentAssurance?.passed&&assuranceFresh
      ?"READY FOR RELEASE"
      :"RELEASE BLOCKED";
  const releaseSeals=currentRelease
    ?state.dossierReleaseSeals.filter(item=>item.releaseId===currentRelease.id)
    :[];
  const latestReleaseSeal=releaseSeals[releaseSeals.length-1]??null;
  const latestReleaseVerification=latestReleaseSeal
    ?[...state.dossierReleaseSealVerifications]
      .reverse()
      .find(item=>item.sealId===latestReleaseSeal.id)??null
    :null;
  const configuredReleaseSignerAlreadySealed=Boolean(
    releaseSealStatus?.keyFingerprint&&
    releaseSeals.some(item=>item.publicKeyFingerprintSha256===releaseSealStatus.keyFingerprint)
  );
  const releaseSealState=!currentRelease
    ?"NO RELEASE"
    :!latestReleaseSeal
      ?"UNSEALED"
      :latestReleaseVerification
        ?"VERIFIED"
        :"SEALED · UNVERIFIED";
  const releaseTimestamps=latestReleaseSeal
    ?state.dossierReleaseRfc3161Timestamps.filter(item=>item.sealId===latestReleaseSeal.id)
    :[];
  const configuredTsaAuthority=rfc3161Status?.authorityUrl??null;
  const configuredTsaTrustAnchor=rfc3161Status?.trustAnchorSha256??null;
  const currentReleaseTimestamp=(
    configuredTsaAuthority&&
    configuredTsaTrustAnchor
  )
    ?[...releaseTimestamps].reverse().find(item=>
      item.authorityUrl===configuredTsaAuthority&&
      item.trustAnchorSha256===configuredTsaTrustAnchor
    )??null
    :null;
  const latestReleaseTimestamp=releaseTimestamps[releaseTimestamps.length-1]??null;
  const releaseTimestampState=!latestReleaseVerification
    ?"VERIFIED RELEASE SEAL REQUIRED"
    :currentReleaseTimestamp
      ?"RFC3161 VERIFIED"
      :rfc3161Status?.state==="configured"
        ?"TSA READY"
        :rfc3161Status?.state==="error"
          ?"TSA ERROR"
          :"TSA DISABLED";
  const currentReleasePackageFingerprint=currentRelease
    ?releasePackageBasisFingerprint(state,currentRelease.id)
    :null;
  const releasePublishEligible=currentRelease
    ?releasePackageHasVerifiedSeal(state,currentRelease.id)
    :false;
  const releasePublications=currentRelease
    ?state.dossierReleasePublications.filter(item=>item.releaseId===currentRelease.id)
    :[];
  const currentReleasePublication=(
    currentReleasePackageFingerprint&&
    releasePublicationStatus?.publisherUrl
  )
    ?[...releasePublications].reverse().find(item=>
      item.packageBasisFingerprint===currentReleasePackageFingerprint&&
      item.publisherUrl===releasePublicationStatus.publisherUrl
    )??null
    :null;
  const latestReleasePublication=releasePublications[releasePublications.length-1]??null;
  const releasePublicationState=!releasePublishEligible
    ?"VERIFIED RELEASE SEAL REQUIRED"
    :currentReleasePublication
      ?"PUBLISHED · READ-BACK VERIFIED"
      :releasePublicationStatus?.state==="configured"
        ?"PUBLISHER READY"
        :releasePublicationStatus?.state==="error"
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

          <div className={"dossier-assurance "+(
            currentAssurance?.passed&&assuranceFresh
              ?"assurance-pass"
              :currentAssurance&&!currentAssurance.passed&&assuranceFresh
                ?"assurance-block"
                :""
          )}>
            <div className="dossier-transparency-head">
              <div>
                <small>PROVENANCE ASSURANCE POLICY</small>
                <strong>
                  {currentAssurance
                    ?assuranceFresh
                      ?currentAssurance.passed?"POLICY SATISFIED":"POLICY NOT SATISFIED"
                      :"REPORT STALE"
                    :"NOT EVALUATED"}
                </strong>
              </div>
              <span>{PROVENANCE_ASSURANCE_POLICY_LABELS[assurancePolicy].toUpperCase()}</span>
            </div>

            <div className="dossier-assurance-controls">
              <label>
                <span>POLICY</span>
                <select
                  value={assurancePolicy}
                  disabled={busy}
                  onChange={event=>setAssurancePolicy(event.currentTarget.value as ProvenanceAssurancePolicyKind)}
                >
                  {(Object.keys(PROVENANCE_ASSURANCE_POLICIES) as ProvenanceAssurancePolicyKind[])
                    .map(policy=><option key={policy} value={policy}>
                      {PROVENANCE_ASSURANCE_POLICY_LABELS[policy]}
                    </option>)}
                </select>
              </label>
              <button
                type="button"
                disabled={busy||Boolean(currentAssurance&&assuranceFresh)}
                onClick={()=>onAssurance(dossier.id,assurancePolicy)}
              >
                {currentAssurance&&assuranceFresh?"CURRENT REPORT FRESH":"EVALUATE ASSURANCE"}
              </button>
            </div>

            {currentAssurance
              ?<div className="dossier-assurance-report">
                <p><b>Report</b> {currentAssurance.id}</p>
                <p><b>Basis</b> {currentAssurance.basisFingerprint}</p>
                <p><b>Checkpoint</b> {currentAssurance.checkpointId||"NONE"}</p>
                <p><b>Journal head</b> {currentAssurance.journalHeadStatus.toUpperCase()}</p>
                <p><b>Freshness</b> {assuranceFresh?"FRESH":"STALE · RE-EVALUATE"}</p>
                <div className="dossier-assurance-requirements">
                  {currentAssurance.requirements.map(item=><div key={item.requirement}>
                    <span>{item.satisfied?"MET":"MISSING"}</span>
                    <b>{PROVENANCE_ASSURANCE_REQUIREMENT_LABELS[item.requirement]}</b>
                    <small>{item.evidenceIds.length?item.evidenceIds.join(" · "):"NO LINKED RECEIPT"}</small>
                  </div>)}
                </div>
                <p><b>Result</b> {currentAssurance.reason}</p>
                <p><b>Truth authority</b> NONE · policy satisfaction is provenance evidence only.</p>
              </div>
              :<p>
                Evaluate the selected policy against canonical dossier, seal, journal, checkpoint,
                witness, timestamp, and publication receipts. No numeric trust score is produced.
              </p>}

            <div className={"dossier-release "+(
              currentRelease&&releaseCurrent
                ?"release-authorized"
                :currentAssurance?.passed&&assuranceFresh
                  ?"release-ready"
                  :"release-blocked"
            )}>
              <div className="dossier-transparency-head">
                <div>
                  <small>ASSURANCE-GATED RELEASE</small>
                  <strong>{releaseState}</strong>
                </div>
                <span>{currentRelease?.id??"NO RELEASE MANIFEST"}</span>
              </div>

              {currentRelease
                ?<div className="dossier-seal-details">
                  <p><b>Manifest</b> {currentRelease.id}</p>
                  <p><b>Policy</b> {PROVENANCE_ASSURANCE_POLICY_LABELS[currentRelease.policy]}</p>
                  <p><b>Assurance</b> {currentRelease.assuranceReportId}</p>
                  <p><b>Checkpoint</b> {currentRelease.checkpointId}</p>
                  <p><b>Override</b> {currentRelease.operatorOverrideId||"NONE"}</p>
                  <p><b>Artifacts</b> {currentRelease.artifactIds.length}</p>
                  <p><b>Manifest fingerprint</b> {currentRelease.manifestFingerprint}</p>
                  <p><b>Release authority</b> FRESH PASSING PROVENANCE POLICY</p>
                  <p><b>Truth authority</b> NONE</p>
                </div>
                :<p>
                  Release requires a fresh passing assurance report for the selected policy.
                  Authorization creates an immutable manifest over the exact receipt ids that justified release.
                </p>}

              <div className="dossier-seal-actions">
                <button
                  type="button"
                  disabled={
                    busy||
                    !currentAssurance||
                    !currentAssurance.passed||
                    !assuranceFresh||
                    Boolean(currentRelease)
                  }
                  onClick={()=>
                    currentAssurance&&
                    onRelease(dossier.id,assurancePolicy,currentAssurance.id)
                  }
                >
                  {currentRelease
                    ?"RELEASE AUTHORIZED"
                    :currentAssurance?.passed&&assuranceFresh
                      ?"AUTHORIZE RELEASE"
                      :"ASSURANCE REQUIRED"}
                </button>
                <button
                  type="button"
                  disabled={!currentRelease}
                  onClick={()=>currentRelease&&exportReleasePackage(state,currentRelease)}
                >
                  EXPORT RELEASE PACKAGE
                </button>
              </div>

              <div className={"dossier-release-seal "+(
                latestReleaseVerification?"release-seal-verified":
                latestReleaseSeal?"release-seal-pending":""
              )}>
                <div className="dossier-transparency-head">
                  <div>
                    <small>CRYPTOGRAPHIC RELEASE SEAL</small>
                    <strong>{releaseSealState}</strong>
                  </div>
                  <span>
                    {releaseSealStatus?.state==="configured"
                      ?"SIGNER "+(releaseSealStatus.signerLabel??"RELEASE")
                      :"SIGNER DISABLED"}
                  </span>
                </div>

                {latestReleaseSeal
                  ?<div className="dossier-seal-details">
                    <p><b>Seal</b> {latestReleaseSeal.id}</p>
                    <p><b>Manifest SHA-256</b> {latestReleaseSeal.manifestSha256}</p>
                    <p><b>Key fingerprint</b> {latestReleaseSeal.publicKeyFingerprintSha256}</p>
                    <p><b>Algorithm</b> {latestReleaseSeal.algorithm} · {latestReleaseSeal.canonicalization}</p>
                    <p><b>Signed</b> {latestReleaseSeal.signedAt} · UNTRUSTED LOCAL CLOCK</p>
                    <p><b>Trust</b> SELF-ATTESTED LOCAL RELEASE KEY · {latestReleaseSeal.signerLabel}</p>
                    {latestReleaseVerification&&<p>
                      <b>Verified</b> VALID · {latestReleaseVerification.verifiedAt}
                    </p>}
                  </div>
                  :<p>
                    The REL manifest is authorized but not yet cryptographically sealed.
                    Release sealing is optional and does not change release authority.
                  </p>}

                {releaseSealStatus?.detail&&<p className="dossier-tool-detail">{releaseSealStatus.detail}</p>}
                {releaseSealError&&<div className="dossier-seal-error">{releaseSealError}</div>}

                <div className="dossier-seal-actions">
                  <button
                    type="button"
                    disabled={
                      busy||
                      !currentRelease||
                      releaseSealStatus?.state!=="configured"||
                      configuredReleaseSignerAlreadySealed
                    }
                    onClick={()=>currentRelease&&onReleaseSeal(currentRelease.id)}
                  >
                    {releaseSealBusy
                      ?"SEALING RELEASE…"
                      :configuredReleaseSignerAlreadySealed
                        ?"CURRENT SIGNER ALREADY SEALED"
                        :"SEAL RELEASE"}
                  </button>
                  <button
                    type="button"
                    disabled={busy||!currentRelease||!latestReleaseSeal||Boolean(latestReleaseVerification)}
                    onClick={()=>
                      currentRelease&&latestReleaseSeal&&
                      onReleaseVerify(currentRelease.id,latestReleaseSeal.id)
                    }
                  >
                    {releaseVerifyBusy
                      ?"VERIFYING…"
                      :latestReleaseVerification
                        ?"RELEASE SEAL VERIFIED"
                        :"VERIFY RELEASE SEAL"}
                  </button>
                </div>

                <div className={"dossier-release-time "+(currentReleaseTimestamp?"release-time-verified":"")}>
                  <div className="dossier-transparency-head">
                    <div>
                      <small>TRUSTED RELEASE TIME</small>
                      <strong>{releaseTimestampState}</strong>
                    </div>
                    <span>RFC 3161 · SHA-256</span>
                  </div>

                  {latestReleaseTimestamp
                    ?<div className="dossier-seal-details">
                      <p><b>Receipt</b> {latestReleaseTimestamp.id}</p>
                      <p><b>Release seal SHA-256</b> {latestReleaseTimestamp.releaseSealSha256}</p>
                      <p><b>Manifest SHA-256</b> {latestReleaseTimestamp.manifestSha256}</p>
                      <p><b>Signer key</b> {latestReleaseTimestamp.publicKeyFingerprintSha256}</p>
                      <p><b>TSA time</b> {latestReleaseTimestamp.genTime}</p>
                      <p><b>Token SHA-256</b> {latestReleaseTimestamp.tokenSha256}</p>
                      <p><b>Policy</b> {latestReleaseTimestamp.tsaPolicyOid}</p>
                      <p><b>Serial</b> {latestReleaseTimestamp.tsaSerialNumber}</p>
                      <p><b>TSA</b> {latestReleaseTimestamp.tsaSubject}</p>
                      <p><b>Authority</b> {latestReleaseTimestamp.authorityUrl}</p>
                      <p><b>Trust anchor SHA-256</b> {latestReleaseTimestamp.trustAnchorSha256}</p>
                      <p><b>Locally verified</b> {latestReleaseTimestamp.verifiedAt}</p>
                    </div>
                    :<p>
                      RFC 3161 can attest when this exact verified RSEAL receipt existed.
                      The TSA time does not establish signer identity or content truth.
                    </p>}

                  {releaseTimestampError&&<div className="dossier-seal-error">{releaseTimestampError}</div>}

                  <div className="dossier-seal-actions">
                    <button
                      type="button"
                      disabled={
                        busy||
                        !currentRelease||
                        !latestReleaseSeal||
                        !latestReleaseVerification||
                        rfc3161Status?.state!=="configured"||
                        Boolean(currentReleaseTimestamp)
                      }
                      onClick={()=>
                        currentRelease&&latestReleaseSeal&&
                        onReleaseTimestamp(currentRelease.id,latestReleaseSeal.id)
                      }
                    >
                      {releaseTimestampBusy
                        ?"REQUESTING TRUSTED TIME…"
                        :currentReleaseTimestamp
                          ?"TRUSTED RELEASE TIME VERIFIED"
                          :"REQUEST TRUSTED RELEASE TIME"}
                    </button>
                  </div>
                </div>

                <div className={"dossier-release-publication "+(currentReleasePublication?"release-publication-verified":"")}>
                  <div className="dossier-transparency-head">
                    <div>
                      <small>EXTERNAL RELEASE PUBLICATION</small>
                      <strong>{releasePublicationState}</strong>
                    </div>
                    <span>{releasePublicationStatus?.protocol??"phi-release-publication-v1"}</span>
                  </div>

                  {latestReleasePublication
                    ?<div className="dossier-seal-details">
                      <p><b>Receipt</b> {latestReleasePublication.id}</p>
                      <p><b>Package basis</b> {latestReleasePublication.packageBasisFingerprint}</p>
                      <p><b>Package SHA-256</b> {latestReleasePublication.packageSha256}</p>
                      <p><b>Manifest SHA-256</b> {latestReleasePublication.manifestSha256}</p>
                      <p><b>Publication</b> {latestReleasePublication.publicationId}</p>
                      <p><b>Publisher</b> {latestReleasePublication.publisherUrl}</p>
                      <p><b>Retrieval</b> {latestReleasePublication.retrievalUrl}</p>
                      <p><b>Publisher claimed time</b> {latestReleasePublication.publisherClaimedAt}</p>
                      <p><b>Read-back verified</b> {latestReleasePublication.retrievalVerifiedAt}</p>
                      <p><b>Receipt SHA-256</b> {latestReleasePublication.receiptSha256}</p>
                    </div>
                    :<p>
                      Publish the exact canonical release package to the configured external publisher,
                      then independently read it back before accepting an RPUB receipt.
                    </p>}

                  {releasePublicationStatus?.detail&&<p className="dossier-tool-detail">{releasePublicationStatus.detail}</p>}
                  {releasePublicationError&&<div className="dossier-seal-error">{releasePublicationError}</div>}

                  <div className="dossier-seal-actions">
                    <button
                      type="button"
                      disabled={
                        busy||
                        !currentRelease||
                        !releasePublishEligible||
                        releasePublicationStatus?.state!=="configured"||
                        Boolean(currentReleasePublication)
                      }
                      onClick={()=>currentRelease&&onReleasePublish(currentRelease.id)}
                    >
                      {releasePublicationBusy
                        ?"PUBLISHING + VERIFYING…"
                        :currentReleasePublication
                          ?"RELEASE PUBLICATION VERIFIED"
                          :"PUBLISH + VERIFY RELEASE"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer>
      <span>Integrity chain: dossier → provenance → assurance → REL → RSEAL → RVER → optional RTSA → optional verified external RPUB. Publication proves retrievability of one exact package, not permanence or truth.</span>
      <button type="button" onClick={()=>exportDossier(state)}>TEAR / EXPORT DOSSIER</button>
    </footer>
  </section>;
}
