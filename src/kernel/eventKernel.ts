import type { ThinkTankEvent,ThinkTankEventInput,ThinkTankState } from "../domain/types";
import { projectEvent } from "../domain/reducer";
import { evaluateEvidence } from "../domain/evidence";
import { evaluateGovernance,initialTurnPlan } from "../domain/scheduler";
import { evaluateClaimCoverage } from "../domain/claimCoverage";
import { evaluateClaimGovernance } from "../domain/claimGovernance";
import { evaluateArgumentGovernance } from "../domain/argumentGovernance";
import {
  buildDecisionOverrideReceipt,
  buildSynthesisDecisionDossier
} from "../domain/decisionDossier";
import {
  argumentReviewBasisFingerprint,
  argumentReviewEligibility,
  argumentReviewEligibleExcerpts,
  argumentReviewIsFresh
} from "../domain/argumentReview";
import {
  evaluateProvenanceAssurance,
  PROVENANCE_ASSURANCE_POLICIES
} from "../domain/provenanceAssurance";
import {
  buildDossierReleaseManifest,
  releaseEligibleAssurance
} from "../domain/releaseManifest";
import {
  buildDossierReleasePackage,
  buildDossierReleasePackageForPublication,
  releasePackageBasisFingerprint,
  releasePackageHasVerifiedSeal
} from "../domain/releasePackage";
import { fingerprintProjection } from "./fingerprint";
import { stableStringify } from "./stable";

export class KernelIntegrityError extends Error{
  constructor(message:string,public readonly seq?:number){
    super(message);
    this.name="KernelIntegrityError";
  }
}

export interface ReplayReport{
  valid:boolean;
  exact:boolean;
  eventCount:number;
  finalFingerprint:string;
  expectedFingerprint?:string;
  error?:string;
}

function assertDossierSealEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.seal.requested",
    "dossier.seal.completed",
    "dossier.seal.failed",
    "dossier.verify.requested",
    "dossier.verify.completed",
    "dossier.verify.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError("Dossier sealing cannot run during active governed execution.",event.seq);
  }

  const dossier=event.decisionDossierId
    ?state.decisionDossiers.find(item=>item.id===event.decisionDossierId)
    :undefined;

  if(event.kind==="dossier.seal.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Dossier seal requests are operator-authorized.",event.seq);
    }
    if(!dossier){
      throw new KernelIntegrityError("Dossier seal request requires an existing decision dossier.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.seal.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Dossier seal completion must be tool-originated.",event.seq);
    }
    const seal=event.dossierSeal;
    if(!seal||!dossier||seal.dossierId!==dossier.id){
      throw new KernelIntegrityError("Dossier seal receipt does not match an existing dossier.",event.seq);
    }
    if(
      seal.tool!=="ed25519-dossier-sealer"||
      seal.algorithm!=="Ed25519"||
      seal.canonicalization!=="json-stable-v1"||
      seal.trust!=="self-attested-local-key"
    ){
      throw new KernelIntegrityError("Dossier seal metadata is invalid.",event.seq);
    }
    const expectedSealId="SEAL-"+dossier.id+"-"+seal.publicKeyFingerprintSha256.slice(0,12);
    if(
      seal.id!==expectedSealId||
      !/^[a-f0-9]{64}$/.test(seal.digestSha256)||
      !/^[a-f0-9]{64}$/.test(seal.publicKeyFingerprintSha256)||
      !seal.signatureBase64.trim()||
      !seal.publicKeyPem.includes("BEGIN PUBLIC KEY")||
      !seal.signerLabel.trim()||
      Number.isNaN(Date.parse(seal.signedAt))
    ){
      throw new KernelIntegrityError("Dossier seal receipt is incomplete or malformed.",event.seq);
    }
    if(state.dossierSeals.some(existing=>
      existing.dossierId===seal.dossierId&&
      existing.publicKeyFingerprintSha256===seal.publicKeyFingerprintSha256
    )){
      throw new KernelIntegrityError("This signer key already sealed the dossier.",event.seq);
    }
    if(state.dossierSeals.some(existing=>existing.id===seal.id)){
      throw new KernelIntegrityError("Dossier seal id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.seal.requested"&&item.decisionDossierId===seal.dossierId
    );
    if(!request){
      throw new KernelIntegrityError("Dossier seal completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.seal.completed"||item.kind==="dossier.seal.failed")&&
      item.decisionDossierId===seal.dossierId
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Dossier seal request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.seal.failed"){
    if(event.source!=="tool"||!dossier){
      throw new KernelIntegrityError("Dossier seal failure must be tool-originated for an existing dossier.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.seal.requested"&&item.decisionDossierId===dossier.id
    );
    if(!request){
      throw new KernelIntegrityError("Dossier seal failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.seal.completed"||item.kind==="dossier.seal.failed")&&
      item.decisionDossierId===dossier.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Dossier seal request is already resolved.",event.seq);
    }
    return true;
  }

  const seal=event.dossierSealId
    ?state.dossierSeals.find(item=>item.id===event.dossierSealId)
    :undefined;

  if(event.kind==="dossier.verify.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Dossier verification requests are operator-authorized.",event.seq);
    }
    if(!seal||!state.decisionDossiers.some(item=>item.id===seal.dossierId)){
      throw new KernelIntegrityError("Dossier verification requires an existing seal and dossier.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.verify.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Dossier verification completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierVerification;
    if(!receipt||!seal){
      throw new KernelIntegrityError("Dossier verification requires a receipt and existing seal.",event.seq);
    }
    if(
      receipt.dossierId!==seal.dossierId||
      receipt.sealId!==seal.id||
      receipt.tool!=="ed25519-dossier-verifier"||
      receipt.algorithm!=="Ed25519"||
      receipt.digestSha256!==seal.digestSha256||
      receipt.publicKeyFingerprintSha256!==seal.publicKeyFingerprintSha256||
      typeof receipt.verified!=="boolean"||
      Number.isNaN(Date.parse(receipt.verifiedAt))
    ){
      throw new KernelIntegrityError("Dossier verification receipt does not match its seal.",event.seq);
    }

    if(state.dossierSealVerifications.some(existing=>existing.id===receipt.id)){
      throw new KernelIntegrityError("Dossier verification receipt id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.verify.requested"&&item.dossierSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Dossier verification has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.verify.completed"||item.kind==="dossier.verify.failed")&&
      item.dossierSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Dossier verification request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.verify.failed"){
    if(event.source!=="tool"||!seal){
      throw new KernelIntegrityError("Dossier verification failure must be tool-originated for an existing seal.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.verify.requested"&&item.dossierSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Dossier verification failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.verify.completed"||item.kind==="dossier.verify.failed")&&
      item.dossierSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Dossier verification request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierTransparencyEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.transparency.requested",
    "dossier.transparency.completed",
    "dossier.transparency.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError("Dossier transparency logging cannot run during active governed execution.",event.seq);
  }

  const seal=event.dossierSealId
    ?state.dossierSeals.find(item=>item.id===event.dossierSealId)
    :undefined;

  if(event.kind==="dossier.transparency.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Transparency journal requests are operator-authorized.",event.seq);
    }
    if(!seal||!state.decisionDossiers.some(item=>item.id===seal.dossierId)){
      throw new KernelIntegrityError("Transparency journal request requires an existing dossier seal.",event.seq);
    }
    if(event.decisionDossierId!==seal.dossierId){
      throw new KernelIntegrityError("Transparency journal request dossier does not match its seal.",event.seq);
    }
    if(state.dossierTransparencyEntries.some(item=>item.sealId===seal.id)){
      throw new KernelIntegrityError("This dossier seal is already present in the transparency journal.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.transparency.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Transparency journal completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierTransparency;
    if(!seal||!receipt||event.decisionDossierId!==seal.dossierId){
      throw new KernelIntegrityError("Transparency journal receipt requires an existing matching dossier seal.",event.seq);
    }
    if(
      receipt.dossierId!==seal.dossierId||
      receipt.sealId!==seal.id||
      receipt.dossierSha256!==seal.digestSha256||
      receipt.publicKeyFingerprintSha256!==seal.publicKeyFingerprintSha256
    ){
      throw new KernelIntegrityError("Transparency journal receipt does not match its dossier seal.",event.seq);
    }
    if(
      receipt.tool!=="sha256-dossier-transparency-journal"||
      receipt.canonicalization!=="json-stable-v1"||
      receipt.clock!=="untrusted-local-clock"||
      receipt.trust!=="tamper-evident-local-journal"||
      receipt.journalVerifiedAtAppend!==true||
      !Number.isInteger(receipt.sequence)||
      receipt.sequence<1||
      !/^[a-f0-9]{64}$/.test(receipt.previousEntrySha256)||
      !/^[a-f0-9]{64}$/.test(receipt.entrySha256)||
      Number.isNaN(Date.parse(receipt.loggedAt))
    ){
      throw new KernelIntegrityError("Transparency journal receipt is incomplete or malformed.",event.seq);
    }

    const expectedId=
      "TLOG-"+String(receipt.sequence).padStart(6,"0")+"-"+receipt.entrySha256.slice(0,12);
    if(receipt.id!==expectedId){
      throw new KernelIntegrityError("Transparency journal receipt id does not match its sequence/hash.",event.seq);
    }
    if(state.dossierTransparencyEntries.some(item=>item.id===receipt.id||item.sealId===receipt.sealId)){
      throw new KernelIntegrityError("Transparency journal receipt or seal already exists.",event.seq);
    }

    const latest=state.dossierTransparencyEntries[state.dossierTransparencyEntries.length-1];
    if(latest&&(
      receipt.sequence!==latest.sequence+1||
      receipt.previousEntrySha256!==latest.entrySha256
    )){
      throw new KernelIntegrityError("Transparency journal chain does not extend the latest accepted entry.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.transparency.requested"&&item.dossierSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Transparency journal completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.transparency.completed"||item.kind==="dossier.transparency.failed")&&
      item.dossierSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Transparency journal request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.transparency.failed"){
    if(event.source!=="tool"||!seal){
      throw new KernelIntegrityError("Transparency journal failure must be tool-originated for an existing seal.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.transparency.requested"&&item.dossierSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Transparency journal failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.transparency.completed"||item.kind==="dossier.transparency.failed")&&
      item.dossierSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Transparency journal request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierCheckpointWitnessEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.checkpoint.requested",
    "dossier.checkpoint.completed",
    "dossier.checkpoint.failed",
    "dossier.witness.requested",
    "dossier.witness.completed",
    "dossier.witness.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError("Dossier checkpoint/witness operations cannot run during active governed execution.",event.seq);
  }

  const latestEntry=state.dossierTransparencyEntries[state.dossierTransparencyEntries.length-1];

  if(event.kind==="dossier.checkpoint.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Transparency checkpoint requests are operator-authorized.",event.seq);
    }
    if(!latestEntry||event.dossierTransparencyId!==latestEntry.id){
      throw new KernelIntegrityError("Transparency checkpoint request must reference the latest accepted journal entry.",event.seq);
    }
    if(state.dossierTransparencyCheckpoints.some(item=>
      item.entryCount===latestEntry.sequence&&item.headSha256===latestEntry.entrySha256
    )){
      throw new KernelIntegrityError("The latest accepted journal head already has a checkpoint.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.checkpoint.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Transparency checkpoint completion must be tool-originated.",event.seq);
    }
    const checkpoint=event.dossierCheckpoint;
    if(!latestEntry||!checkpoint||event.dossierTransparencyId!==latestEntry.id){
      throw new KernelIntegrityError("Transparency checkpoint completion requires the latest accepted journal entry.",event.seq);
    }
    if(
      checkpoint.tool!=="sha256-transparency-checkpoint"||
      checkpoint.canonicalization!=="json-stable-v1"||
      checkpoint.clock!=="untrusted-local-clock"||
      checkpoint.trust!=="portable-local-checkpoint"||
      checkpoint.entryCount!==latestEntry.sequence||
      checkpoint.headEntryId!==latestEntry.id||
      checkpoint.headSha256!==latestEntry.entrySha256||
      !/^[a-f0-9]{64}$/.test(checkpoint.checkpointSha256)||
      Number.isNaN(Date.parse(checkpoint.createdAt))
    ){
      throw new KernelIntegrityError("Transparency checkpoint receipt does not match the accepted journal head.",event.seq);
    }
    const expectedId=
      "CHK-"+String(checkpoint.entryCount).padStart(6,"0")+"-"+checkpoint.checkpointSha256.slice(0,12);
    if(checkpoint.id!==expectedId){
      throw new KernelIntegrityError("Transparency checkpoint id does not match its sequence/digest.",event.seq);
    }
    if(state.dossierTransparencyCheckpoints.some(item=>item.id===checkpoint.id)){
      throw new KernelIntegrityError("Transparency checkpoint id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.checkpoint.requested"&&item.dossierTransparencyId===latestEntry.id
    );
    if(!request){
      throw new KernelIntegrityError("Transparency checkpoint completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.checkpoint.completed"||item.kind==="dossier.checkpoint.failed")&&
      item.dossierTransparencyId===latestEntry.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Transparency checkpoint request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.checkpoint.failed"){
    if(event.source!=="tool"||!latestEntry||event.dossierTransparencyId!==latestEntry.id){
      throw new KernelIntegrityError("Transparency checkpoint failure must be tool-originated for the latest accepted journal entry.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.checkpoint.requested"&&item.dossierTransparencyId===latestEntry.id
    );
    if(!request){
      throw new KernelIntegrityError("Transparency checkpoint failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.checkpoint.completed"||item.kind==="dossier.checkpoint.failed")&&
      item.dossierTransparencyId===latestEntry.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Transparency checkpoint request is already resolved.",event.seq);
    }
    return true;
  }

  const checkpoint=event.dossierCheckpointId
    ?state.dossierTransparencyCheckpoints.find(item=>item.id===event.dossierCheckpointId)
    :undefined;
  const witness=event.dossierWitness;

  const assertWitnessShape=()=>{
    if(!checkpoint||!witness||witness.checkpointId!==checkpoint.id){
      throw new KernelIntegrityError("Detached witness receipt must reference an existing transparency checkpoint.",event.seq);
    }
    if(
      witness.tool!=="ed25519-transparency-witness"||
      witness.algorithm!=="Ed25519"||
      witness.canonicalization!=="json-stable-v1"||
      witness.trust!=="self-attested-external-witness-key"||
      witness.checkpointSha256!==checkpoint.checkpointSha256||
      !/^[a-f0-9]{64}$/.test(witness.publicKeyFingerprintSha256)||
      !witness.publicKeyPem.includes("BEGIN PUBLIC KEY")||
      !witness.signatureBase64.trim()||
      !witness.witnessLabel.trim()||
      Number.isNaN(Date.parse(witness.witnessedAt))
    ){
      throw new KernelIntegrityError("Detached witness receipt is incomplete or malformed.",event.seq);
    }
    const expectedId="WIT-"+checkpoint.id+"-"+witness.publicKeyFingerprintSha256.slice(0,12);
    if(witness.id!==expectedId){
      throw new KernelIntegrityError("Detached witness id does not match its checkpoint/key fingerprint.",event.seq);
    }
  };

  if(event.kind==="dossier.witness.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Detached witness verification requests are operator-authorized.",event.seq);
    }
    assertWitnessShape();
    if(state.dossierTransparencyWitnesses.some(item=>
      item.checkpointId===checkpoint!.id&&
      item.publicKeyFingerprintSha256===witness!.publicKeyFingerprintSha256
    )){
      throw new KernelIntegrityError("This witness key is already accepted for the checkpoint.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.witness.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Detached witness verification completion must be tool-originated.",event.seq);
    }
    assertWitnessShape();
    const verification=event.dossierWitnessVerification;
    if(
      !verification||
      verification.id!=="WVER-"+witness!.id||
      verification.checkpointId!==checkpoint!.id||
      verification.witnessId!==witness!.id||
      verification.tool!=="ed25519-transparency-witness-verifier"||
      verification.algorithm!=="Ed25519"||
      verification.checkpointSha256!==checkpoint!.checkpointSha256||
      verification.publicKeyFingerprintSha256!==witness!.publicKeyFingerprintSha256||
      verification.verified!==true||
      Number.isNaN(Date.parse(verification.verifiedAt))
    ){
      throw new KernelIntegrityError("Detached witness verification receipt does not match its checkpoint/witness.",event.seq);
    }
    if(
      state.dossierTransparencyWitnesses.some(item=>item.id===witness!.id)||
      state.dossierTransparencyWitnessVerifications.some(item=>item.id===verification.id)
    ){
      throw new KernelIntegrityError("Detached witness or verification receipt id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.witness.requested"&&
      item.dossierCheckpointId===checkpoint!.id&&
      item.dossierWitness?.id===witness!.id
    );
    if(!request||stableStringify(request.dossierWitness)!==stableStringify(witness)){
      throw new KernelIntegrityError("Detached witness completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.witness.completed"||item.kind==="dossier.witness.failed")&&
      item.dossierCheckpointId===checkpoint!.id&&
      item.dossierWitness?.id===witness!.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Detached witness verification request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.witness.failed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Detached witness verification failure must be tool-originated.",event.seq);
    }
    assertWitnessShape();
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.witness.requested"&&
      item.dossierCheckpointId===checkpoint!.id&&
      item.dossierWitness?.id===witness!.id
    );
    if(!request||stableStringify(request.dossierWitness)!==stableStringify(witness)){
      throw new KernelIntegrityError("Detached witness verification failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.witness.completed"||item.kind==="dossier.witness.failed")&&
      item.dossierCheckpointId===checkpoint!.id&&
      item.dossierWitness?.id===witness!.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Detached witness verification request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierTimestampEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.timestamp.requested",
    "dossier.timestamp.completed",
    "dossier.timestamp.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError("RFC3161 timestamp operations cannot run during active governed execution.",event.seq);
  }

  const checkpoint=event.dossierCheckpointId
    ?state.dossierTransparencyCheckpoints.find(item=>item.id===event.dossierCheckpointId)
    :undefined;

  if(event.kind==="dossier.timestamp.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("RFC3161 timestamp requests are operator-authorized.",event.seq);
    }
    if(!checkpoint){
      throw new KernelIntegrityError("RFC3161 timestamp request requires an existing transparency checkpoint.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.timestamp.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("RFC3161 timestamp completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierTimestamp;
    if(!checkpoint||!receipt||receipt.checkpointId!==checkpoint.id){
      throw new KernelIntegrityError("RFC3161 timestamp receipt requires an existing matching checkpoint.",event.seq);
    }
    if(
      receipt.tool!=="rfc3161-timestamp-verifier"||
      receipt.standard!=="RFC3161"||
      receipt.hashAlgorithm!=="SHA-256"||
      receipt.trust!=="configured-rfc3161-trust-anchor"||
      receipt.checkpointSha256!==checkpoint.checkpointSha256||
      !/^[a-f0-9]{64}$/.test(receipt.tokenSha256)||
      !receipt.tokenBase64.trim()||
      !receipt.tsaPolicyOid.trim()||
      !receipt.tsaSerialNumber.trim()||
      !receipt.tsaSubject.trim()||
      !receipt.authorityUrl.trim()||
      !/^[a-f0-9]{64}$/.test(receipt.trustAnchorSha256)||
      Number.isNaN(Date.parse(receipt.genTime))||
      Number.isNaN(Date.parse(receipt.verifiedAt))
    ){
      throw new KernelIntegrityError("RFC3161 timestamp receipt is incomplete or malformed.",event.seq);
    }
    const expectedId="TSA-"+checkpoint.id+"-"+receipt.tokenSha256.slice(0,12);
    if(receipt.id!==expectedId){
      throw new KernelIntegrityError("RFC3161 timestamp id does not match its checkpoint/token digest.",event.seq);
    }
    if(state.dossierRfc3161Timestamps.some(item=>item.id===receipt.id)){
      throw new KernelIntegrityError("RFC3161 timestamp receipt id already exists.",event.seq);
    }
    if(state.dossierRfc3161Timestamps.some(item=>
      item.checkpointId===checkpoint.id&&
      item.authorityUrl===receipt.authorityUrl&&
      item.trustAnchorSha256===receipt.trustAnchorSha256
    )){
      throw new KernelIntegrityError("This configured RFC3161 authority already timestamped the checkpoint.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.timestamp.requested"&&item.dossierCheckpointId===checkpoint.id
    );
    if(!request){
      throw new KernelIntegrityError("RFC3161 timestamp completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.timestamp.completed"||item.kind==="dossier.timestamp.failed")&&
      item.dossierCheckpointId===checkpoint.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("RFC3161 timestamp request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.timestamp.failed"){
    if(event.source!=="tool"||!checkpoint){
      throw new KernelIntegrityError("RFC3161 timestamp failure must be tool-originated for an existing checkpoint.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.timestamp.requested"&&item.dossierCheckpointId===checkpoint.id
    );
    if(!request){
      throw new KernelIntegrityError("RFC3161 timestamp failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.timestamp.completed"||item.kind==="dossier.timestamp.failed")&&
      item.dossierCheckpointId===checkpoint.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("RFC3161 timestamp request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierPublicationEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.publication.requested",
    "dossier.publication.completed",
    "dossier.publication.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError("Checkpoint publication cannot run during active governed execution.",event.seq);
  }

  const checkpoint=event.dossierCheckpointId
    ?state.dossierTransparencyCheckpoints.find(item=>item.id===event.dossierCheckpointId)
    :undefined;

  if(event.kind==="dossier.publication.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Checkpoint publication requests are operator-authorized.",event.seq);
    }
    if(!checkpoint){
      throw new KernelIntegrityError("Checkpoint publication requires an existing transparency checkpoint.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.publication.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Checkpoint publication completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierPublication;
    if(!checkpoint||!receipt||receipt.checkpointId!==checkpoint.id){
      throw new KernelIntegrityError("Publication receipt requires an existing matching checkpoint.",event.seq);
    }

    let publisherUrl:URL;
    let retrievalUrl:URL;
    try{
      publisherUrl=new URL(receipt.publisherUrl);
      retrievalUrl=new URL(receipt.retrievalUrl);
    }catch{
      throw new KernelIntegrityError("Publication receipt URLs are invalid.",event.seq);
    }

    if(
      receipt.tool!=="verified-checkpoint-publisher"||
      receipt.protocol!=="phi-checkpoint-publication-v1"||
      receipt.trust!=="externally-retrieved-publication"||
      receipt.checkpointSha256!==checkpoint.checkpointSha256||
      publisherUrl.protocol!=="https:"||
      retrievalUrl.protocol!=="https:"||
      !receipt.publicationId.trim()||
      Number.isNaN(Date.parse(receipt.publisherClaimedAt))||
      !/^[a-f0-9]{64}$/.test(receipt.payloadSha256)||
      !Number.isInteger(receipt.retrievalHttpStatus)||
      receipt.retrievalHttpStatus<200||
      receipt.retrievalHttpStatus>=300||
      !receipt.retrievalContentType.toLowerCase().startsWith("application/json")||
      Number.isNaN(Date.parse(receipt.retrievalVerifiedAt))||
      !/^[a-f0-9]{64}$/.test(receipt.receiptSha256)
    ){
      throw new KernelIntegrityError("Checkpoint publication receipt is incomplete or malformed.",event.seq);
    }

    const expectedId="PUB-"+checkpoint.id+"-"+receipt.receiptSha256.slice(0,12);
    if(receipt.id!==expectedId){
      throw new KernelIntegrityError("Checkpoint publication id does not match its receipt digest.",event.seq);
    }
    if(state.dossierCheckpointPublications.some(item=>item.id===receipt.id)){
      throw new KernelIntegrityError("Checkpoint publication receipt id already exists.",event.seq);
    }
    if(state.dossierCheckpointPublications.some(item=>
      item.checkpointId===checkpoint.id&&item.publisherUrl===receipt.publisherUrl
    )){
      throw new KernelIntegrityError("This publisher already has an accepted publication for the checkpoint.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.publication.requested"&&item.dossierCheckpointId===checkpoint.id
    );
    if(!request){
      throw new KernelIntegrityError("Checkpoint publication completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.publication.completed"||item.kind==="dossier.publication.failed")&&
      item.dossierCheckpointId===checkpoint.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Checkpoint publication request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.publication.failed"){
    if(event.source!=="tool"||!checkpoint){
      throw new KernelIntegrityError("Checkpoint publication failure must be tool-originated for an existing checkpoint.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.publication.requested"&&item.dossierCheckpointId===checkpoint.id
    );
    if(!request){
      throw new KernelIntegrityError("Checkpoint publication failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.publication.completed"||item.kind==="dossier.publication.failed")&&
      item.dossierCheckpointId===checkpoint.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Checkpoint publication request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierAssuranceEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.assurance.requested",
    "dossier.assurance.completed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Provenance assurance evaluation cannot run during active governed execution.",
      event.seq
    );
  }

  const dossier=event.decisionDossierId
    ?state.decisionDossiers.find(item=>item.id===event.decisionDossierId)
    :undefined;
  const policy=event.provenancePolicy;

  if(event.kind==="dossier.assurance.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Provenance assurance requests are operator-authorized.",event.seq);
    }
    if(!dossier){
      throw new KernelIntegrityError("Provenance assurance requires an existing decision dossier.",event.seq);
    }
    if(!policy||!PROVENANCE_ASSURANCE_POLICIES[policy]){
      throw new KernelIntegrityError("Provenance assurance request has an unsupported policy.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.assurance.completed"){
    if(event.source!=="system"){
      throw new KernelIntegrityError("Provenance assurance completion must be system-originated.",event.seq);
    }
    if(!dossier||!policy||!event.provenanceAssurance){
      throw new KernelIntegrityError(
        "Provenance assurance completion requires dossier, policy, and report.",
        event.seq
      );
    }

    let expected;
    try{
      expected=evaluateProvenanceAssurance(state,dossier.id,policy);
    }catch(error){
      throw new KernelIntegrityError(
        error instanceof Error?error.message:String(error),
        event.seq
      );
    }

    if(stableStringify(event.provenanceAssurance)!==stableStringify(expected)){
      throw new KernelIntegrityError(
        "Provenance assurance report does not match deterministic recomputation.",
        event.seq
      );
    }
    if(event.provenanceAssurance.truthAuthority!==false){
      throw new KernelIntegrityError(
        "Provenance assurance reports cannot claim factual truth authority.",
        event.seq
      );
    }
    if(state.dossierProvenanceAssurances.some(item=>item.id===expected.id)){
      throw new KernelIntegrityError(
        "This dossier/policy/provenance basis already has an assurance report.",
        event.seq
      );
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.assurance.requested"&&
      item.decisionDossierId===dossier.id&&
      item.provenancePolicy===policy
    );
    if(!request){
      throw new KernelIntegrityError(
        "Provenance assurance completion has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      item.kind==="dossier.assurance.completed"&&
      item.decisionDossierId===dossier.id&&
      item.provenancePolicy===policy
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError(
        "Provenance assurance request is already resolved.",
        event.seq
      );
    }
    return true;
  }

  return false;
}

function assertDossierReleaseEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.release.requested",
    "dossier.release.authorized"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Dossier release authorization cannot run during active governed execution.",
      event.seq
    );
  }

  const dossier=event.decisionDossierId
    ?state.decisionDossiers.find(item=>item.id===event.decisionDossierId)
    :undefined;
  const policy=event.provenancePolicy;
  const assuranceId=event.provenanceAssuranceId;

  if(event.kind==="dossier.release.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Dossier release requests are operator-authorized.",event.seq);
    }
    if(!dossier||!policy||!assuranceId){
      throw new KernelIntegrityError(
        "Dossier release request requires dossier, policy, and assurance report id.",
        event.seq
      );
    }
    if(!PROVENANCE_ASSURANCE_POLICIES[policy]){
      throw new KernelIntegrityError("Dossier release request has an unsupported policy.",event.seq);
    }
    const eligible=releaseEligibleAssurance(state,dossier.id,policy,assuranceId);
    if(!eligible){
      throw new KernelIntegrityError(
        "Dossier release requires a fresh passing assurance report for the selected policy.",
        event.seq
      );
    }
    if(state.dossierReleaseManifests.some(item=>
      item.dossierId===dossier.id&&
      item.policy===policy&&
      item.assuranceReportId===assuranceId
    )){
      throw new KernelIntegrityError(
        "This dossier/policy/assurance basis already has a release manifest.",
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.authorized"){
    if(event.source!=="system"){
      throw new KernelIntegrityError("Dossier release authorization must be system-originated.",event.seq);
    }
    if(!dossier||!policy||!assuranceId||!event.dossierRelease){
      throw new KernelIntegrityError(
        "Dossier release authorization requires dossier, policy, assurance id, and manifest.",
        event.seq
      );
    }

    let expected;
    try{
      expected=buildDossierReleaseManifest(state,dossier.id,policy,assuranceId);
    }catch(error){
      throw new KernelIntegrityError(
        error instanceof Error?error.message:String(error),
        event.seq
      );
    }

    if(stableStringify(event.dossierRelease)!==stableStringify(expected)){
      throw new KernelIntegrityError(
        "Dossier release manifest does not match deterministic recomputation.",
        event.seq
      );
    }
    if(
      event.dossierRelease.truthAuthority!==false||
      event.dossierRelease.releaseAuthority!=="fresh-passing-provenance-policy"
    ){
      throw new KernelIntegrityError(
        "Dossier release manifest authority labels are invalid.",
        event.seq
      );
    }
    if(state.dossierReleaseManifests.some(item=>item.id===expected.id)){
      throw new KernelIntegrityError("Dossier release manifest id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.requested"&&
      item.decisionDossierId===dossier.id&&
      item.provenancePolicy===policy&&
      item.provenanceAssuranceId===assuranceId
    );
    if(!request){
      throw new KernelIntegrityError(
        "Dossier release authorization has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.authorized"&&
      item.decisionDossierId===dossier.id&&
      item.provenancePolicy===policy&&
      item.provenanceAssuranceId===assuranceId
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Dossier release request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierReleaseSealEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.release.seal.requested",
    "dossier.release.seal.completed",
    "dossier.release.seal.failed",
    "dossier.release.verify.requested",
    "dossier.release.verify.completed",
    "dossier.release.verify.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Release sealing cannot run during active governed execution.",
      event.seq
    );
  }

  const release=event.dossierReleaseId
    ?state.dossierReleaseManifests.find(item=>item.id===event.dossierReleaseId)
    :undefined;

  if(event.kind==="dossier.release.seal.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Release seal requests are operator-authorized.",event.seq);
    }
    if(!release){
      throw new KernelIntegrityError("Release seal request requires an existing release manifest.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.release.seal.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Release seal completion must be tool-originated.",event.seq);
    }
    const seal=event.dossierReleaseSeal;
    if(!release||!seal||seal.releaseId!==release.id||seal.dossierId!==release.dossierId){
      throw new KernelIntegrityError("Release seal receipt does not match an existing release manifest.",event.seq);
    }
    if(
      seal.tool!=="ed25519-release-sealer"||
      seal.algorithm!=="Ed25519"||
      seal.canonicalization!=="json-stable-v1"||
      seal.clock!=="untrusted-local-clock"||
      seal.trust!=="self-attested-local-release-key"
    ){
      throw new KernelIntegrityError("Release seal metadata is invalid.",event.seq);
    }
    const expectedId="RSEAL-"+release.id+"-"+seal.publicKeyFingerprintSha256.slice(0,12);
    if(
      seal.id!==expectedId||
      !/^[a-f0-9]{64}$/.test(seal.manifestSha256)||
      !/^[a-f0-9]{64}$/.test(seal.publicKeyFingerprintSha256)||
      !seal.signatureBase64.trim()||
      !seal.publicKeyPem.includes("BEGIN PUBLIC KEY")||
      !seal.signerLabel.trim()||
      Number.isNaN(Date.parse(seal.signedAt))
    ){
      throw new KernelIntegrityError("Release seal receipt is incomplete or malformed.",event.seq);
    }
    if(state.dossierReleaseSeals.some(existing=>
      existing.releaseId===seal.releaseId&&
      existing.publicKeyFingerprintSha256===seal.publicKeyFingerprintSha256
    )){
      throw new KernelIntegrityError("This signer key already sealed the release manifest.",event.seq);
    }
    if(state.dossierReleaseSeals.some(existing=>existing.id===seal.id)){
      throw new KernelIntegrityError("Release seal id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.seal.requested"&&item.dossierReleaseId===release.id
    );
    if(!request){
      throw new KernelIntegrityError("Release seal completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.seal.completed"||item.kind==="dossier.release.seal.failed")&&
      item.dossierReleaseId===release.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release seal request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.release.seal.failed"){
    if(event.source!=="tool"||!release){
      throw new KernelIntegrityError(
        "Release seal failure must be tool-originated for an existing release manifest.",
        event.seq
      );
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.seal.requested"&&item.dossierReleaseId===release.id
    );
    if(!request){
      throw new KernelIntegrityError("Release seal failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.seal.completed"||item.kind==="dossier.release.seal.failed")&&
      item.dossierReleaseId===release.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release seal request is already resolved.",event.seq);
    }
    return true;
  }

  const seal=event.dossierReleaseSealId
    ?state.dossierReleaseSeals.find(item=>item.id===event.dossierReleaseSealId)
    :undefined;

  if(event.kind==="dossier.release.verify.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Release seal verification requests are operator-authorized.",event.seq);
    }
    if(!seal||!state.dossierReleaseManifests.some(item=>item.id===seal.releaseId)){
      throw new KernelIntegrityError(
        "Release seal verification requires an existing release seal and manifest.",
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.verify.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Release seal verification completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierReleaseVerification;
    if(!seal||!receipt){
      throw new KernelIntegrityError("Release seal verification requires a receipt and existing seal.",event.seq);
    }
    if(
      receipt.id!=="RVER-"+seal.id||
      receipt.releaseId!==seal.releaseId||
      receipt.sealId!==seal.id||
      receipt.tool!=="ed25519-release-verifier"||
      receipt.algorithm!=="Ed25519"||
      receipt.manifestSha256!==seal.manifestSha256||
      receipt.publicKeyFingerprintSha256!==seal.publicKeyFingerprintSha256||
      receipt.verified!==true||
      Number.isNaN(Date.parse(receipt.verifiedAt))
    ){
      throw new KernelIntegrityError("Release verification receipt does not match its seal.",event.seq);
    }
    if(state.dossierReleaseSealVerifications.some(existing=>existing.id===receipt.id)){
      throw new KernelIntegrityError("Release verification receipt id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.verify.requested"&&item.dossierReleaseSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Release seal verification has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.verify.completed"||item.kind==="dossier.release.verify.failed")&&
      item.dossierReleaseSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release seal verification request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.release.verify.failed"){
    if(event.source!=="tool"||!seal){
      throw new KernelIntegrityError(
        "Release seal verification failure must be tool-originated for an existing release seal.",
        event.seq
      );
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.verify.requested"&&item.dossierReleaseSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError("Release seal verification failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.verify.completed"||item.kind==="dossier.release.verify.failed")&&
      item.dossierReleaseSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release seal verification request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierReleaseTimestampEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.release.timestamp.requested",
    "dossier.release.timestamp.completed",
    "dossier.release.timestamp.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Release timestamping cannot run during active governed execution.",
      event.seq
    );
  }

  const seal=event.dossierReleaseSealId
    ?state.dossierReleaseSeals.find(item=>item.id===event.dossierReleaseSealId)
    :undefined;

  if(event.kind==="dossier.release.timestamp.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Release timestamp requests are operator-authorized.",event.seq);
    }
    if(!seal){
      throw new KernelIntegrityError("Release timestamp request requires an existing release seal.",event.seq);
    }
    const verified=state.dossierReleaseSealVerifications.some(item=>
      item.sealId===seal.id&&item.releaseId===seal.releaseId&&item.verified===true
    );
    if(!verified){
      throw new KernelIntegrityError(
        "Release timestamp requires a successfully verified release seal.",
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.timestamp.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Release timestamp completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierReleaseTimestamp;
    if(!seal||!receipt){
      throw new KernelIntegrityError(
        "Release timestamp completion requires an existing release seal and receipt.",
        event.seq
      );
    }
    if(
      receipt.releaseId!==seal.releaseId||
      receipt.sealId!==seal.id||
      receipt.tool!=="rfc3161-release-seal-timestamp-verifier"||
      receipt.standard!=="RFC3161"||
      receipt.hashAlgorithm!=="SHA-256"||
      receipt.manifestSha256!==seal.manifestSha256||
      receipt.publicKeyFingerprintSha256!==seal.publicKeyFingerprintSha256||
      receipt.trust!=="configured-rfc3161-trust-anchor"
    ){
      throw new KernelIntegrityError(
        "Release RFC3161 timestamp receipt does not match its verified release seal.",
        event.seq
      );
    }
    const expectedId="RTSA-"+seal.id+"-"+receipt.tokenSha256.slice(0,12);
    if(
      receipt.id!==expectedId||
      !/^[a-f0-9]{64}$/.test(receipt.releaseSealSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.tokenSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.trustAnchorSha256)||
      !receipt.tokenBase64.trim()||
      !receipt.tsaPolicyOid.trim()||
      !receipt.tsaSerialNumber.trim()||
      !receipt.tsaSubject.trim()||
      !receipt.authorityUrl.trim()||
      Number.isNaN(Date.parse(receipt.genTime))||
      Number.isNaN(Date.parse(receipt.verifiedAt))
    ){
      throw new KernelIntegrityError(
        "Release RFC3161 timestamp receipt is incomplete or malformed.",
        event.seq
      );
    }
    try{
      const url=new URL(receipt.authorityUrl);
      if((url.protocol!=="https:"&&url.protocol!=="http:")||url.username||url.password){
        throw new Error("bad");
      }
    }catch{
      throw new KernelIntegrityError("Release RFC3161 authority URL is invalid.",event.seq);
    }
    if(state.dossierReleaseRfc3161Timestamps.some(existing=>existing.id===receipt.id)){
      throw new KernelIntegrityError("Release RFC3161 timestamp id already exists.",event.seq);
    }
    if(state.dossierReleaseRfc3161Timestamps.some(existing=>
      existing.sealId===seal.id&&
      existing.authorityUrl===receipt.authorityUrl&&
      existing.trustAnchorSha256===receipt.trustAnchorSha256
    )){
      throw new KernelIntegrityError(
        "This release seal already has a timestamp from the configured authority/trust anchor.",
        event.seq
      );
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.timestamp.requested"&&item.dossierReleaseSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release timestamp completion has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.timestamp.completed"||item.kind==="dossier.release.timestamp.failed")&&
      item.dossierReleaseSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release timestamp request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.release.timestamp.failed"){
    if(event.source!=="tool"||!seal){
      throw new KernelIntegrityError(
        "Release timestamp failure must be tool-originated for an existing release seal.",
        event.seq
      );
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.timestamp.requested"&&item.dossierReleaseSealId===seal.id
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release timestamp failure has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.timestamp.completed"||item.kind==="dossier.release.timestamp.failed")&&
      item.dossierReleaseSealId===seal.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release timestamp request is already resolved.",event.seq);
    }
    return true;
  }

  return false;
}

function assertDossierReleasePublicationEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.release.publication.requested",
    "dossier.release.publication.completed",
    "dossier.release.publication.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Release publication cannot run during active governed execution.",
      event.seq
    );
  }

  const release=event.dossierReleaseId
    ?state.dossierReleaseManifests.find(item=>item.id===event.dossierReleaseId)
    :undefined;

  if(event.kind==="dossier.release.publication.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Release publication requests are operator-authorized.",event.seq);
    }
    if(!release||!event.dossierReleasePackageFingerprint){
      throw new KernelIntegrityError(
        "Release publication request requires a release and pinned package fingerprint.",
        event.seq
      );
    }
    if(!releasePackageHasVerifiedSeal(state,release.id)){
      throw new KernelIntegrityError(
        "Release publication requires at least one successfully verified release seal.",
        event.seq
      );
    }
    const expected=releasePackageBasisFingerprint(state,release.id);
    if(event.dossierReleasePackageFingerprint!==expected){
      throw new KernelIntegrityError(
        "Release publication request package fingerprint is stale or invalid.",
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.publication.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Release publication completion must be tool-originated.",event.seq);
    }
    const receipt=event.dossierReleasePublication;
    if(!release||!receipt){
      throw new KernelIntegrityError(
        "Release publication completion requires an existing release and receipt.",
        event.seq
      );
    }

    const currentFingerprint=releasePackageBasisFingerprint(state,release.id);
    const packageValue=buildDossierReleasePackage(state,release.id);
    const expectedSealIds=packageValue.releaseSeals.map(item=>item.id);
    const expectedVerificationIds=packageValue.releaseSealVerifications.map(item=>item.id);
    const expectedTimestampIds=packageValue.releaseRfc3161Timestamps.map(item=>item.id);
    const expectedArtifactIds=[...release.artifactIds];
    const verifiedSeal=packageValue.releaseSeals.find(seal=>
      packageValue.releaseSealVerifications.some(item=>item.sealId===seal.id)
    );

    if(
      receipt.releaseId!==release.id||
      receipt.tool!=="verified-release-package-publisher"||
      receipt.protocol!=="phi-release-publication-v1"||
      receipt.packageBasisFingerprint!==currentFingerprint||
      !verifiedSeal||
      receipt.manifestSha256!==verifiedSeal.manifestSha256||
      receipt.trust!=="externally-retrieved-release-publication"||
      stableStringify(receipt.releaseSealIds)!==stableStringify(expectedSealIds)||
      stableStringify(receipt.releaseVerificationIds)!==stableStringify(expectedVerificationIds)||
      stableStringify(receipt.releaseTimestampIds)!==stableStringify(expectedTimestampIds)||
      stableStringify(receipt.artifactIds)!==stableStringify(expectedArtifactIds)
    ){
      throw new KernelIntegrityError(
        "Release publication receipt does not match the pinned canonical release package.",
        event.seq
      );
    }

    const expectedId="RPUB-"+release.id+"-"+receipt.receiptSha256.slice(0,12);
    if(
      receipt.id!==expectedId||
      !/^fnv1a32:[a-f0-9]{8}$/.test(receipt.packageBasisFingerprint)||
      !/^[a-f0-9]{64}$/.test(receipt.manifestSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.packageSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.receiptSha256)||
      !receipt.publicationId.trim()||
      receipt.publicationId.length>300||
      receipt.retrievalHttpStatus<200||
      receipt.retrievalHttpStatus>=300||
      receipt.retrievalContentType!=="application/json"||
      Number.isNaN(Date.parse(receipt.publisherClaimedAt))||
      Number.isNaN(Date.parse(receipt.retrievalVerifiedAt))
    ){
      throw new KernelIntegrityError("Release publication receipt is incomplete or malformed.",event.seq);
    }

    for(const raw of [receipt.publisherUrl,receipt.retrievalUrl]){
      try{
        const url=new URL(raw);
        if(url.protocol!=="https:"||url.username||url.password||url.hash)throw new Error("bad");
      }catch{
        throw new KernelIntegrityError(
          "Release publication URLs must be credential-free HTTPS URLs without fragments.",
          event.seq
        );
      }
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.publication.requested"&&
      item.dossierReleaseId===release.id&&
      item.dossierReleasePackageFingerprint===receipt.packageBasisFingerprint
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release publication completion has no matching operator request for this package basis.",
        event.seq
      );
    }

    if(state.dossierReleasePublications.some(existing=>existing.id===receipt.id)){
      throw new KernelIntegrityError("Release publication receipt id already exists.",event.seq);
    }
    if(state.dossierReleasePublications.some(existing=>
      existing.releaseId===release.id&&
      existing.publisherUrl===receipt.publisherUrl&&
      existing.packageBasisFingerprint===receipt.packageBasisFingerprint
    )){
      throw new KernelIntegrityError(
        "This exact release package was already published through this publisher.",
        event.seq
      );
    }

    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.publication.completed"||
       item.kind==="dossier.release.publication.failed")&&
      item.dossierReleaseId===release.id&&
      item.dossierReleasePackageFingerprint===receipt.packageBasisFingerprint
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Release publication request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="dossier.release.publication.failed"){
    if(event.source!=="tool"||!release||!event.dossierReleasePackageFingerprint){
      throw new KernelIntegrityError(
        "Release publication failure must be tool-originated for a pinned release package.",
        event.seq
      );
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.publication.requested"&&
      item.dossierReleaseId===release.id&&
      item.dossierReleasePackageFingerprint===event.dossierReleasePackageFingerprint
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release publication failure has no matching operator request.",
        event.seq
      );
    }
    return true;
  }

  return false;
}

function assertDossierReleasePublicationAuditEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "dossier.release.publication.audit.requested",
    "dossier.release.publication.audit.completed",
    "dossier.release.publication.audit.failed"
  ].includes(event.kind);

  if(
    action&&
    state.phase!=="intake"&&
    state.phase!=="synthesis"&&
    state.phase!=="complete"&&
    state.phase!=="aborted"
  ){
    throw new KernelIntegrityError(
      "Release publication durability audit cannot run during active governed execution.",
      event.seq
    );
  }

  const publication=event.dossierReleasePublicationId
    ?state.dossierReleasePublications.find(item=>item.id===event.dossierReleasePublicationId)
    :undefined;

  if(event.kind==="dossier.release.publication.audit.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError(
        "Release publication durability audits are operator-authorized.",
        event.seq
      );
    }
    if(!publication){
      throw new KernelIntegrityError(
        "Release publication durability audit requires an existing RPUB receipt.",
        event.seq
      );
    }
    if(event.dossierReleaseId!==publication.releaseId){
      throw new KernelIntegrityError(
        "Release publication durability request REL id does not match RPUB.",
        event.seq
      );
    }
    try{
      buildDossierReleasePackageForPublication(state,publication);
    }catch(error){
      throw new KernelIntegrityError(
        "Historical RPUB package cannot be reconstructed: "+
        (error instanceof Error?error.message:String(error)),
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.publication.audit.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError(
        "Release publication durability completion must be tool-originated.",
        event.seq
      );
    }
    const receipt=event.dossierReleasePublicationAudit;
    if(!publication||!receipt){
      throw new KernelIntegrityError(
        "Release publication durability completion requires RPUB and RAUD receipts.",
        event.seq
      );
    }
    if(event.dossierReleaseId!==publication.releaseId){
      throw new KernelIntegrityError(
        "Release publication durability completion REL id does not match RPUB.",
        event.seq
      );
    }
    try{
      buildDossierReleasePackageForPublication(state,publication);
    }catch(error){
      throw new KernelIntegrityError(
        "Historical RPUB package cannot be reconstructed: "+
        (error instanceof Error?error.message:String(error)),
        event.seq
      );
    }

    if(
      receipt.releaseId!==publication.releaseId||
      receipt.publicationReceiptId!==publication.id||
      receipt.publicationReceiptSha256!==publication.receiptSha256||
      receipt.tool!=="release-publication-durability-auditor"||
      receipt.protocol!=="phi-release-publication-audit-v1"||
      receipt.packageBasisFingerprint!==publication.packageBasisFingerprint||
      receipt.packageSha256!==publication.packageSha256||
      receipt.retrievalUrl!==publication.retrievalUrl||
      receipt.clock!=="untrusted-local-clock"||
      receipt.readbackSha256!==publication.packageSha256||
      receipt.exactMatch!==true||
      receipt.trust!=="repeat-external-retrieval"
    ){
      throw new KernelIntegrityError(
        "RAUD receipt does not match its historical RPUB package.",
        event.seq
      );
    }

    const expectedId="RAUD-"+publication.id+"-"+receipt.receiptSha256.slice(0,12);
    if(
      receipt.id!==expectedId||
      !/^fnv1a32:[a-f0-9]{8}$/.test(receipt.packageBasisFingerprint)||
      !/^[a-f0-9]{64}$/.test(receipt.publicationReceiptSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.packageSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.readbackSha256)||
      !/^[a-f0-9]{64}$/.test(receipt.receiptSha256)||
      receipt.retrievalHttpStatus<200||
      receipt.retrievalHttpStatus>=300||
      receipt.retrievalContentType!=="application/json"||
      Number.isNaN(Date.parse(receipt.checkedAt))
    ){
      throw new KernelIntegrityError(
        "Release publication durability receipt is incomplete or malformed.",
        event.seq
      );
    }
    try{
      const url=new URL(receipt.retrievalUrl);
      if(url.protocol!=="https:"||url.username||url.password||url.hash)throw new Error("bad");
    }catch{
      throw new KernelIntegrityError(
        "Release publication durability retrieval URL is invalid.",
        event.seq
      );
    }
    if(state.dossierReleasePublicationAudits.some(existing=>existing.id===receipt.id)){
      throw new KernelIntegrityError("Release publication durability receipt id already exists.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.publication.audit.requested"&&
      item.dossierReleasePublicationId===publication.id
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release publication durability completion has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.publication.audit.completed"||
       item.kind==="dossier.release.publication.audit.failed")&&
      item.dossierReleasePublicationId===publication.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError(
        "Release publication durability request is already resolved.",
        event.seq
      );
    }
    return true;
  }

  if(event.kind==="dossier.release.publication.audit.failed"){
    if(event.source!=="tool"||!publication){
      throw new KernelIntegrityError(
        "Release publication durability failure must be tool-originated for an existing RPUB.",
        event.seq
      );
    }
    if(event.dossierReleaseId!==publication.releaseId){
      throw new KernelIntegrityError(
        "Release publication durability failure REL id does not match RPUB.",
        event.seq
      );
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="dossier.release.publication.audit.requested"&&
      item.dossierReleasePublicationId===publication.id
    );
    if(!request){
      throw new KernelIntegrityError(
        "Release publication durability failure has no matching operator request.",
        event.seq
      );
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="dossier.release.publication.audit.completed"||
       item.kind==="dossier.release.publication.audit.failed")&&
      item.dossierReleasePublicationId===publication.id
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError(
        "Release publication durability request is already resolved.",
        event.seq
      );
    }
    return true;
  }

  return false;
}

function assertArgumentReviewEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "argument.review.requested",
    "argument.review.completed",
    "argument.review.failed",
    "argument.review.accepted",
    "argument.review.dismissed"
  ].includes(event.kind);

  if(action&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Argument review cannot run during an active governed session.",event.seq);
  }

  if(event.kind==="argument.review.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Argument review requests are operator-authorized.",event.seq);
    }
    if(event.roleId!=="challenger"){
      throw new KernelIntegrityError("Argument review must be scoped to Challenger.",event.seq);
    }
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Argument review requires an existing claim.",event.seq);
    }
    const assignment=state.assignments.find(item=>item.roleId==="challenger");
    if(!assignment||event.seatId!==assignment.seatId){
      throw new KernelIntegrityError("Argument review must route through the currently assigned Challenger seat.",event.seq);
    }
    if(state.seatStatus[event.seatId]==="offline"){
      throw new KernelIntegrityError("Argument review cannot route through an offline Challenger seat.",event.seq);
    }
    const eligibility=argumentReviewEligibility(state,event.claimId);
    if(!eligibility.allowed){
      throw new KernelIntegrityError(eligibility.reason,event.seq);
    }
    return true;
  }

  if(event.kind==="argument.review.completed"){
    if(event.source!=="provider"){
      throw new KernelIntegrityError("Argument review completion must be provider-originated.",event.seq);
    }
    if(event.roleId!=="challenger"){
      throw new KernelIntegrityError("Argument review completion must be Challenger-scoped.",event.seq);
    }
    const review=event.argumentReview;
    if(!review){
      throw new KernelIntegrityError("Argument review completion requires a review payload.",event.seq);
    }
    if(
      event.claimId!==review.claimId||
      event.seatId!==review.seatId||
      event.providerModel!==review.providerModel||
      event.providerRequestId!==review.providerRequestId
    ){
      throw new KernelIntegrityError("Argument review event metadata does not match its review payload.",event.seq);
    }
    if(review.roleId!=="challenger"||review.status!=="draft"){
      throw new KernelIntegrityError("Provider argument reviews must enter as Challenger DRAFT artifacts.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===review.claimId)){
      throw new KernelIntegrityError("Argument review references an unknown claim.",event.seq);
    }
    if(state.argumentReviews.some(existing=>existing.id===review.id)){
      throw new KernelIntegrityError("Argument review id already exists: "+review.id+".",event.seq);
    }
    if(!review.id.trim()||!review.providerModel.trim()){
      throw new KernelIntegrityError("Argument review requires id and provider model.",event.seq);
    }
    if(Number.isNaN(Date.parse(review.createdAt))){
      throw new KernelIntegrityError("Argument review timestamp is invalid.",event.seq);
    }

    const assignment=state.assignments.find(item=>item.roleId==="challenger");
    if(!assignment||review.seatId!==assignment.seatId){
      throw new KernelIntegrityError("Argument review provider seat no longer matches Challenger assignment.",event.seq);
    }

    const expectedBasis=argumentReviewBasisFingerprint(state,review.claimId);
    if(!expectedBasis||review.basisFingerprint!==expectedBasis){
      throw new KernelIntegrityError("Argument review basis fingerprint does not match current claim excerpts.",event.seq);
    }

    const eligible=argumentReviewEligibleExcerpts(state,review.claimId).map(item=>item.id);
    const eligibleSet=new Set(eligible);
    if(review.points.length!==eligible.length||review.points.length<1||review.points.length>12){
      throw new KernelIntegrityError("Argument review must account for every eligible excerpt exactly once.",event.seq);
    }

    const seen=new Set<string>();
    for(const point of review.points){
      if(!eligibleSet.has(point.excerptId)||seen.has(point.excerptId)){
        throw new KernelIntegrityError("Argument review excerpt references are invalid or duplicated.",event.seq);
      }
      seen.add(point.excerptId);
      if(!point.premise.trim()||point.premise.length>600){
        throw new KernelIntegrityError("Argument review premise is invalid.",event.seq);
      }
      if(!point.inference.trim()||point.inference.length>800){
        throw new KernelIntegrityError("Argument review inference is invalid.",event.seq);
      }
      if(!point.objection.trim()||point.objection.length>800){
        throw new KernelIntegrityError("Argument review objection is invalid.",event.seq);
      }
    }
    if(eligible.some(id=>!seen.has(id))){
      throw new KernelIntegrityError("Argument review omitted an eligible excerpt.",event.seq);
    }
    if(!review.summary.trim()||review.summary.length>1000){
      throw new KernelIntegrityError("Argument review summary is invalid.",event.seq);
    }
    if(review.unresolvedGaps.length>8||review.unresolvedGaps.some(gap=>!gap.trim()||gap.length>500)){
      throw new KernelIntegrityError("Argument review unresolved gaps are invalid.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="argument.review.requested"&&
      item.claimId===review.claimId&&
      item.roleId==="challenger"&&
      item.seatId===review.seatId
    );
    if(!request){
      throw new KernelIntegrityError("Argument review completion has no matching operator request.",event.seq);
    }

    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="argument.review.completed"||item.kind==="argument.review.failed")&&
      item.claimId===review.claimId&&
      item.roleId==="challenger"&&
      item.seatId===review.seatId
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Argument review request is already resolved.",event.seq);
    }

    const basisMutations=new Set([
      "claim.added","claim.removed",
      "evidence.added","evidence.removed",
      "evidence.bound","evidence.unbound",
      "evidence.excerpt.added","evidence.excerpt.removed"
    ]);
    if(state.events.some(item=>item.seq>request.seq&&basisMutations.has(item.kind))){
      throw new KernelIntegrityError("Argument review basis changed after request; request a fresh review.",event.seq);
    }

    return true;
  }

  if(event.kind==="argument.review.failed"){
    if(event.source!=="provider"){
      throw new KernelIntegrityError("Argument review failure must be provider-originated.",event.seq);
    }
    if(event.roleId!=="challenger"||!event.claimId||!event.seatId){
      throw new KernelIntegrityError("Argument review failure requires Challenger, claim, and seat metadata.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="argument.review.requested"&&
      item.claimId===event.claimId&&
      item.roleId==="challenger"&&
      item.seatId===event.seatId
    );
    if(!request){
      throw new KernelIntegrityError("Argument review failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="argument.review.completed"||item.kind==="argument.review.failed")&&
      item.claimId===event.claimId&&
      item.roleId==="challenger"&&
      item.seatId===event.seatId
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Argument review request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="argument.review.accepted"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Argument review acceptance is operator-authorized.",event.seq);
    }
    const review=state.argumentReviews.find(item=>item.id===event.argumentReviewId);
    if(!review||review.status!=="draft"){
      throw new KernelIntegrityError("Only an existing DRAFT argument review may be accepted.",event.seq);
    }
    if(!argumentReviewIsFresh(state,review)){
      throw new KernelIntegrityError("Stale argument reviews cannot be accepted; request a fresh Challenger review.",event.seq);
    }
    return true;
  }

  if(event.kind==="argument.review.dismissed"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Argument review dismissal is operator-authorized.",event.seq);
    }
    const review=state.argumentReviews.find(item=>item.id===event.argumentReviewId);
    if(!review||review.status==="dismissed"){
      throw new KernelIntegrityError("Argument review dismissal requires an active review.",event.seq);
    }
    return true;
  }

  return false;
}

function assertClaimReviewEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const reviewAction=
    event.kind==="claim.review.requested"||
    event.kind==="claim.review.completed";

  if(reviewAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Claim review cannot run during an active governed session.",event.seq);
  }

  if(event.kind==="claim.review.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Claim review requests are operator-authorized.",event.seq);
    }
    if(event.roleId!=="challenger"){
      throw new KernelIntegrityError("Claim review must be scoped to Challenger.",event.seq);
    }
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Claim review requires an existing claim.",event.seq);
    }
    return true;
  }

  if(event.kind==="claim.review.completed"){
    if(event.source!=="system"){
      throw new KernelIntegrityError("Claim review completion must be system-originated.",event.seq);
    }
    if(event.roleId!=="challenger"){
      throw new KernelIntegrityError("Claim review completion must be Challenger-scoped.",event.seq);
    }
    const review=event.claimReview;
    if(!review){
      throw new KernelIntegrityError("Claim review completion requires a review receipt.",event.seq);
    }
    if(event.claimId!==review.claimId){
      throw new KernelIntegrityError("Claim review event metadata does not match its receipt.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===review.claimId)){
      throw new KernelIntegrityError("Claim review references an unknown claim.",event.seq);
    }
    if(!review.id.trim()){
      throw new KernelIntegrityError("Claim review requires an id.",event.seq);
    }
    if(Number.isNaN(Date.parse(review.reviewedAt))){
      throw new KernelIntegrityError("Claim review timestamp is invalid.",event.seq);
    }
    if(state.claimReviews.some(existing=>existing.id===review.id)){
      throw new KernelIntegrityError("Claim review id already exists: "+review.id+".",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="claim.review.requested"&&
      item.claimId===review.claimId&&
      item.roleId==="challenger"
    );
    if(!request){
      throw new KernelIntegrityError("Claim review completion has no matching operator request.",event.seq);
    }

    const terminal=[...state.events].reverse().find(item=>
      item.kind==="claim.review.completed"&&
      item.claimId===review.claimId
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Claim review request is already resolved.",event.seq);
    }

    const graphMutations=new Set([
      "claim.added","claim.removed","evidence.added","evidence.removed",
      "evidence.bound","evidence.unbound",
      "evidence.excerpt.added","evidence.excerpt.removed"
    ]);
    const changedAfterRequest=state.events.some(item=>
      item.seq>request.seq&&graphMutations.has(item.kind)
    );
    if(changedAfterRequest){
      throw new KernelIntegrityError("Claim graph changed after review request; request a fresh Challenger audit.",event.seq);
    }

    const expected=evaluateClaimCoverage(
      state,
      review.claimId,
      review.id,
      review.reviewedAt
    );
    if(stableStringify(review)!==stableStringify(expected)){
      throw new KernelIntegrityError("Claim review receipt does not match deterministic recomputation.",event.seq);
    }
    return true;
  }

  return false;
}

function assertResearchEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const researchAction=
    event.kind==="research.search.requested"||
    event.kind==="research.search.completed"||
    event.kind==="research.search.failed";

  if(researchAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Research search cannot run during an active governed session.",event.seq);
  }

  const assertClaimAndQuery=()=>{
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Research search requires an existing claim.",event.seq);
    }
    if(!event.researchQuery?.trim()){
      throw new KernelIntegrityError("Research search requires a query.",event.seq);
    }
    if(event.researchQuery.trim().length>300){
      throw new KernelIntegrityError("Research query exceeds the 300 character limit.",event.seq);
    }
  };

  if(event.kind==="research.search.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Research search requests are operator-authorized.",event.seq);
    }
    assertClaimAndQuery();
    return true;
  }

  if(event.kind==="research.search.failed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Research search failure must be tool-originated.",event.seq);
    }
    assertClaimAndQuery();

    const request=[...state.events].reverse().find(item=>
      item.kind==="research.search.requested"&&
      item.claimId===event.claimId&&
      item.researchQuery===event.researchQuery
    );
    if(!request){
      throw new KernelIntegrityError("Research failure has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="research.search.completed"||item.kind==="research.search.failed")&&
      item.claimId===event.claimId&&
      item.researchQuery===event.researchQuery
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Research request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="research.search.completed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Research search completion must be tool-originated.",event.seq);
    }

    const receipt=event.researchReceipt;
    if(!receipt){
      throw new KernelIntegrityError("Research completion requires a search receipt.",event.seq);
    }
    if(receipt.tool!=="searxng-search"||receipt.provider!=="searxng"){
      throw new KernelIntegrityError("Research receipt must originate from the SearXNG search adapter.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===receipt.claimId)){
      throw new KernelIntegrityError("Research receipt references an unknown claim.",event.seq);
    }
    if(event.claimId!==receipt.claimId||event.researchQuery!==receipt.query){
      throw new KernelIntegrityError("Research completion event metadata does not match its receipt.",event.seq);
    }
    if(!receipt.query.trim()||receipt.query.length>300){
      throw new KernelIntegrityError("Research receipt query is invalid.",event.seq);
    }
    if(Number.isNaN(Date.parse(receipt.searchedAt))){
      throw new KernelIntegrityError("Research receipt timestamp is invalid.",event.seq);
    }
    if(!/^[a-f0-9]{64}$/.test(receipt.resultDigest)){
      throw new KernelIntegrityError("Research receipt requires a lowercase SHA-256 result digest.",event.seq);
    }
    if(receipt.candidates.length>10){
      throw new KernelIntegrityError("Research receipt exceeds the 10 candidate kernel cap.",event.seq);
    }

    const request=[...state.events].reverse().find(item=>
      item.kind==="research.search.requested"&&
      item.claimId===receipt.claimId&&
      item.researchQuery===receipt.query
    );
    if(!request){
      throw new KernelIntegrityError("Research completion has no matching operator request.",event.seq);
    }
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="research.search.completed"||item.kind==="research.search.failed")&&
      item.claimId===receipt.claimId&&
      item.researchQuery===receipt.query
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Research request is already resolved.",event.seq);
    }

    const ids=new Set<string>();
    const uris=new Set<string>();
    for(let index=0;index<receipt.candidates.length;index++){
      const candidate=receipt.candidates[index];
      if(!candidate.id.trim()||ids.has(candidate.id)||state.researchCandidates.some(item=>item.id===candidate.id)){
        throw new KernelIntegrityError("Research candidate id is missing or duplicated.",event.seq);
      }
      ids.add(candidate.id);

      if(candidate.claimId!==receipt.claimId||candidate.query!==receipt.query){
        throw new KernelIntegrityError("Research candidate does not match its receipt claim/query.",event.seq);
      }
      if(candidate.discoveredAt!==receipt.searchedAt){
        throw new KernelIntegrityError("Research candidate timestamp must match the receipt.",event.seq);
      }
      if(candidate.rank!==index+1){
        throw new KernelIntegrityError("Research candidate ranks must be contiguous from 1.",event.seq);
      }
      if(!candidate.title.trim()||!candidate.engine.trim()){
        throw new KernelIntegrityError("Research candidate requires title and engine.",event.seq);
      }

      let url:URL;
      try{url=new URL(candidate.uri);}catch{
        throw new KernelIntegrityError("Research candidate URI is invalid.",event.seq);
      }
      if((url.protocol!=="http:"&&url.protocol!=="https:")||url.username||url.password){
        throw new KernelIntegrityError("Research candidate URI must be credential-free HTTP/S.",event.seq);
      }
      if(url.protocol==="http:"&&url.port&&url.port!=="80"){
        throw new KernelIntegrityError("HTTP research candidates may only use port 80.",event.seq);
      }
      if(url.protocol==="https:"&&url.port&&url.port!=="443"){
        throw new KernelIntegrityError("HTTPS research candidates may only use port 443.",event.seq);
      }

      const normalized=url.toString();
      if(candidate.uri!==normalized){
        throw new KernelIntegrityError("Research candidate URI must already be canonicalized.",event.seq);
      }
      if(uris.has(normalized)||state.researchCandidates.some(item=>
        item.claimId===candidate.claimId&&item.uri===normalized
      )){
        throw new KernelIntegrityError("Research candidate URI is duplicated for this claim.",event.seq);
      }
      uris.add(normalized);
    }
    return true;
  }

  return false;
}

function assertClaimEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const claimAction=
    event.kind==="claim.added"||
    event.kind==="claim.removed"||
    event.kind==="evidence.bound"||
    event.kind==="evidence.unbound";

  if(claimAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Claim graph cannot mutate during an active governed session.",event.seq);
  }

  if(event.kind==="claim.added"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Claim creation is operator-authorized.",event.seq);
    }
    const claim=event.claim;
    if(!claim||!claim.id.trim()||!claim.text.trim()){
      throw new KernelIntegrityError("Claim add event requires id and text.",event.seq);
    }
    if(claim.addedBy!=="operator"){
      throw new KernelIntegrityError("Claim must declare addedBy=operator.",event.seq);
    }
    if(state.claims.some(existing=>existing.id===claim.id)){
      throw new KernelIntegrityError("Claim id already exists: "+claim.id+".",event.seq);
    }
    if(state.claims.some(existing=>existing.text.trim().toLowerCase()===claim.text.trim().toLowerCase())){
      throw new KernelIntegrityError("An equivalent claim already exists.",event.seq);
    }
    return true;
  }

  if(event.kind==="claim.removed"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Claim removal is operator-authorized.",event.seq);
    }
    if(!event.claimId||!state.claims.some(claim=>claim.id===event.claimId)){
      throw new KernelIntegrityError("Claim removal requires an existing claim id.",event.seq);
    }
    if(state.claimBindings.some(binding=>binding.claimId===event.claimId)){
      throw new KernelIntegrityError("Cannot remove a claim while evidence bindings still exist.",event.seq);
    }
    if(state.argumentReviews.some(review=>review.claimId===event.claimId&&review.status!=="dismissed")){
      throw new KernelIntegrityError("Cannot remove a claim while active argument reviews still exist.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.bound"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence binding is operator-authorized.",event.seq);
    }
    const binding=event.claimBinding;
    if(!binding||!binding.id.trim()||!binding.claimId.trim()||!binding.evidenceId.trim()){
      throw new KernelIntegrityError("Evidence binding requires binding, claim, and evidence ids.",event.seq);
    }
    if(binding.addedBy!=="operator"){
      throw new KernelIntegrityError("Evidence binding must declare addedBy=operator.",event.seq);
    }
    if(!["supports","contradicts","context"].includes(binding.relation)){
      throw new KernelIntegrityError("Evidence binding relation is invalid.",event.seq);
    }
    if(!state.claims.some(claim=>claim.id===binding.claimId)){
      throw new KernelIntegrityError("Evidence binding references an unknown claim.",event.seq);
    }
    if(!state.evidenceRefs.some(ref=>ref.id===binding.evidenceId)){
      throw new KernelIntegrityError("Evidence binding references unknown evidence.",event.seq);
    }
    if(state.claimBindings.some(existing=>existing.id===binding.id)){
      throw new KernelIntegrityError("Claim binding id already exists: "+binding.id+".",event.seq);
    }
    if(state.claimBindings.some(existing=>
      existing.claimId===binding.claimId&&existing.evidenceId===binding.evidenceId
    )){
      throw new KernelIntegrityError("Evidence is already bound to this claim; unbind before changing relation.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.unbound"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence unbinding is operator-authorized.",event.seq);
    }
    if(!event.claimBindingId||!state.claimBindings.some(binding=>binding.id===event.claimBindingId)){
      throw new KernelIntegrityError("Evidence unbind requires an existing claim binding id.",event.seq);
    }
    return true;
  }

  return false;
}

function assertExcerptEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const action=[
    "evidence.excerpt.requested",
    "evidence.excerpt.failed",
    "evidence.excerpt.added",
    "evidence.excerpt.removed"
  ].includes(event.kind);

  if(action&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Evidence excerpts cannot mutate during an active governed session.",event.seq);
  }

  const evidence=event.evidenceId
    ?state.evidenceRefs.find(ref=>ref.id===event.evidenceId)
    :undefined;

  if(event.kind==="evidence.excerpt.requested"){
    if(event.source!=="operator")throw new KernelIntegrityError("Excerpt requests are operator-authorized.",event.seq);
    if(!evidence||evidence.verification!=="machine-verified"||!evidence.retrieval){
      throw new KernelIntegrityError("Excerpt request requires machine-verified evidence.",event.seq);
    }
    const start=event.excerptStart;
    const end=event.excerptEnd;
    if(typeof start!=="number"||typeof end!=="number"||
       !Number.isInteger(start)||!Number.isInteger(end)||
       start<0||end<=start||end-start>1600){
      throw new KernelIntegrityError("Excerpt request range is invalid or exceeds 1600 characters.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.excerpt.failed"){
    if(event.source!=="tool")throw new KernelIntegrityError("Excerpt failure must be tool-originated.",event.seq);
    if(!event.evidenceId)throw new KernelIntegrityError("Excerpt failure requires evidence id.",event.seq);
    const request=[...state.events].reverse().find(item=>
      item.kind==="evidence.excerpt.requested"&&
      item.evidenceId===event.evidenceId&&
      item.excerptStart===event.excerptStart&&
      item.excerptEnd===event.excerptEnd
    );
    if(!request)throw new KernelIntegrityError("Excerpt failure has no matching operator request.",event.seq);
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="evidence.excerpt.added"||item.kind==="evidence.excerpt.failed")&&
      item.evidenceId===event.evidenceId&&
      item.excerptStart===event.excerptStart&&
      item.excerptEnd===event.excerptEnd
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Excerpt request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.excerpt.added"){
    if(event.source!=="tool")throw new KernelIntegrityError("Verified excerpt addition must be tool-originated.",event.seq);
    const excerpt=event.evidenceExcerpt;
    if(!excerpt)throw new KernelIntegrityError("Excerpt add event requires a receipt.",event.seq);
    const ref=state.evidenceRefs.find(item=>item.id===excerpt.evidenceId);
    if(!ref||ref.verification!=="machine-verified"||!ref.retrieval){
      throw new KernelIntegrityError("Excerpt references non-machine-verified evidence.",event.seq);
    }
    if(event.evidenceId!==excerpt.evidenceId||event.excerptStart!==excerpt.startChar||event.excerptEnd!==excerpt.endChar){
      throw new KernelIntegrityError("Excerpt event metadata does not match its receipt.",event.seq);
    }
    if(excerpt.tool!=="text-projector"||excerpt.extractor!=="text-projection-v1"||excerpt.addedBy!=="tool"){
      throw new KernelIntegrityError("Excerpt provenance is invalid.",event.seq);
    }
    if(excerpt.sourceUri!==ref.uri||excerpt.sourceSha256!==ref.retrieval.sha256){
      throw new KernelIntegrityError("Excerpt source provenance does not match evidence receipt.",event.seq);
    }
    if(excerpt.contentType!==ref.retrieval.contentType){
      throw new KernelIntegrityError("Excerpt content type does not match evidence receipt.",event.seq);
    }
    if(!/^[a-f0-9]{64}$/.test(excerpt.projectionSha256)||!/^[a-f0-9]{64}$/.test(excerpt.excerptSha256)){
      throw new KernelIntegrityError("Excerpt requires lowercase SHA-256 digests.",event.seq);
    }
    if(!excerpt.text.trim()||excerpt.endChar-excerpt.startChar!==excerpt.text.length||excerpt.text.length>1600){
      throw new KernelIntegrityError("Excerpt text/range is invalid.",event.seq);
    }
    if(Number.isNaN(Date.parse(excerpt.extractedAt)))throw new KernelIntegrityError("Excerpt timestamp is invalid.",event.seq);
    if(state.evidenceExcerpts.some(existing=>existing.id===excerpt.id)){
      throw new KernelIntegrityError("Excerpt id already exists.",event.seq);
    }
    if(state.evidenceExcerpts.some(existing=>
      existing.evidenceId===excerpt.evidenceId&&
      existing.projectionSha256===excerpt.projectionSha256&&
      existing.startChar===excerpt.startChar&&
      existing.endChar===excerpt.endChar
    )){
      throw new KernelIntegrityError("Equivalent excerpt already exists.",event.seq);
    }
    const request=[...state.events].reverse().find(item=>
      item.kind==="evidence.excerpt.requested"&&
      item.evidenceId===excerpt.evidenceId&&
      item.excerptStart===excerpt.startChar&&
      item.excerptEnd===excerpt.endChar
    );
    if(!request)throw new KernelIntegrityError("Excerpt receipt has no matching operator request.",event.seq);
    const terminal=[...state.events].reverse().find(item=>
      (item.kind==="evidence.excerpt.added"||item.kind==="evidence.excerpt.failed")&&
      item.evidenceId===excerpt.evidenceId&&
      item.excerptStart===excerpt.startChar&&
      item.excerptEnd===excerpt.endChar
    );
    if(terminal&&terminal.seq>request.seq){
      throw new KernelIntegrityError("Excerpt request is already resolved.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.excerpt.removed"){
    if(event.source!=="operator")throw new KernelIntegrityError("Excerpt removal is operator-authorized.",event.seq);
    if(!event.evidenceExcerptId||!state.evidenceExcerpts.some(excerpt=>excerpt.id===event.evidenceExcerptId)){
      throw new KernelIntegrityError("Excerpt removal requires an existing excerpt id.",event.seq);
    }
    if(state.argumentReviews.some(review=>
      review.status!=="dismissed"&&review.points.some(point=>point.excerptId===event.evidenceExcerptId)
    )){
      throw new KernelIntegrityError("Cannot remove an excerpt while active argument reviews still cite it.",event.seq);
    }
    return true;
  }

  return false;
}

function assertEvidenceEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  const evidenceAction=
    event.kind==="evidence.fetch.requested"||
    event.kind==="evidence.fetch.failed"||
    event.kind==="evidence.added"||
    event.kind==="evidence.removed";

  if(evidenceAction&&state.phase!=="intake"&&state.phase!=="complete"&&state.phase!=="aborted"){
    throw new KernelIntegrityError("Evidence packet cannot mutate during an active governed session.",event.seq);
  }

  if(event.kind==="evidence.fetch.requested"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence fetch requests are operator-authorized.",event.seq);
    }
    if(!event.evidenceUri?.trim()){
      throw new KernelIntegrityError("Evidence fetch request requires a URI.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.fetch.failed"){
    if(event.source!=="tool"){
      throw new KernelIntegrityError("Evidence fetch failure must be tool-originated.",event.seq);
    }
    if(!event.evidenceUri?.trim()){
      throw new KernelIntegrityError("Evidence fetch failure requires the requested URI.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.added"){
    const ref=event.evidenceRef;
    if(!ref)throw new KernelIntegrityError("Evidence add event requires an evidence reference.",event.seq);
    if(!ref.id.trim()||!ref.label.trim()){
      throw new KernelIntegrityError("Evidence reference requires id and label.",event.seq);
    }
    if(state.evidenceRefs.some(existing=>existing.id===ref.id)){
      throw new KernelIntegrityError("Evidence id already exists: "+ref.id+".",event.seq);
    }
    if(ref.researchCandidateId){
      const candidate=state.researchCandidates.find(item=>item.id===ref.researchCandidateId);
      if(!candidate){
        throw new KernelIntegrityError("Machine evidence references an unknown research candidate.",event.seq);
      }
      if(state.evidenceRefs.some(existing=>existing.researchCandidateId===ref.researchCandidateId)){
        throw new KernelIntegrityError("Research candidate has already been promoted to evidence.",event.seq);
      }
    }
    if(ref.uri&&state.evidenceRefs.some(existing=>existing.uri===ref.uri)){
      throw new KernelIntegrityError("Evidence URI already exists; reuse the existing receipt across claims.",event.seq);
    }
    if(ref.retrieval&&state.evidenceRefs.some(existing=>
      existing.retrieval?.sha256===ref.retrieval?.sha256
    )){
      throw new KernelIntegrityError("Evidence content digest already exists; duplicate provenance cannot increase breadth.",event.seq);
    }
    if(event.source==="operator"){
      if(ref.addedBy!=="operator"){
        throw new KernelIntegrityError("Operator evidence must declare addedBy=operator.",event.seq);
      }
      if(ref.verification==="machine-verified"){
        throw new KernelIntegrityError("Operator evidence cannot self-declare machine verification.",event.seq);
      }
    }else if(event.source==="tool"){
      if(ref.addedBy!=="tool"){
        throw new KernelIntegrityError("Tool evidence must declare addedBy=tool.",event.seq);
      }
      if(ref.verification!=="machine-verified"){
        throw new KernelIntegrityError("Tool evidence must declare machine verification.",event.seq);
      }
      if(ref.researchCandidateId){
        const candidate=state.researchCandidates.find(item=>item.id===ref.researchCandidateId)!;
        if(ref.retrieval?.requestedUri!==candidate.uri){
          throw new KernelIntegrityError("Research candidate URI must match the evidence retrieval request.",event.seq);
        }
      }
      if(ref.kind!=="external-source"){
        throw new KernelIntegrityError("Machine-retrieved evidence must use external-source kind.",event.seq);
      }

      const receipt=ref.retrieval;
      if(!receipt){
        throw new KernelIntegrityError("Machine-verified evidence requires a retrieval receipt.",event.seq);
      }
      if(receipt.tool!=="url-fetch"){
        throw new KernelIntegrityError("Unsupported evidence retrieval tool.",event.seq);
      }
      if(!receipt.requestedUri.trim()||!receipt.finalUri.trim()){
        throw new KernelIntegrityError("Retrieval receipt requires requested and final URIs.",event.seq);
      }
      if(ref.uri!==receipt.finalUri){
        throw new KernelIntegrityError("Evidence URI must match retrieval receipt final URI.",event.seq);
      }
      if(receipt.httpStatus<200||receipt.httpStatus>=300){
        throw new KernelIntegrityError("Machine-verified evidence requires a successful HTTP status.",event.seq);
      }
      if(!receipt.contentType.trim()){
        throw new KernelIntegrityError("Retrieval receipt requires a content type.",event.seq);
      }
      if(receipt.bytes<0||!Number.isFinite(receipt.bytes)){
        throw new KernelIntegrityError("Retrieval receipt byte count is invalid.",event.seq);
      }
      if(!/^[a-f0-9]{64}$/.test(receipt.sha256)){
        throw new KernelIntegrityError("Retrieval receipt requires a lowercase SHA-256 digest.",event.seq);
      }
      if(receipt.redirects<0||!Number.isInteger(receipt.redirects)){
        throw new KernelIntegrityError("Retrieval receipt redirect count is invalid.",event.seq);
      }
      if(Number.isNaN(Date.parse(receipt.retrievedAt))){
        throw new KernelIntegrityError("Retrieval receipt timestamp is invalid.",event.seq);
      }
    }else if(event.source==="system"){
      if(ref.addedBy!=="system"){
        throw new KernelIntegrityError("System evidence must declare addedBy=system.",event.seq);
      }
      if(ref.verification==="machine-verified"){
        throw new KernelIntegrityError("Machine verification is reserved for governed tool receipts.",event.seq);
      }
    }else{
      throw new KernelIntegrityError("Evidence may only be added by operator, system, or governed tool.",event.seq);
    }
    return true;
  }

  if(event.kind==="evidence.removed"){
    if(event.source!=="operator"){
      throw new KernelIntegrityError("Evidence removal is operator-authorized.",event.seq);
    }
    if(!event.evidenceId||!state.evidenceRefs.some(ref=>ref.id===event.evidenceId)){
      throw new KernelIntegrityError("Evidence removal requires an existing evidence id.",event.seq);
    }
    if(state.claimBindings.some(binding=>binding.evidenceId===event.evidenceId)){
      throw new KernelIntegrityError("Cannot remove evidence while claim bindings still exist.",event.seq);
    }
    if(state.evidenceExcerpts.some(excerpt=>excerpt.evidenceId===event.evidenceId)){
      throw new KernelIntegrityError("Cannot remove evidence while excerpt receipts still exist.",event.seq);
    }
    return true;
  }

  return false;
}

function assertRoutingEvent(state:ThinkTankState,event:ThinkTankEvent):boolean{
  if(event.kind==="seat.status"){
    if(!event.seatId||!event.seatStatus){
      throw new KernelIntegrityError("Seat status event requires seat id and status.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.pinned"){
    if(!event.roleId||!event.seatId){
      throw new KernelIntegrityError("Role pin requires role id and seat id.",event.seq);
    }
    if(state.seatStatus[event.seatId]==="offline"){
      throw new KernelIntegrityError("Cannot pin a role to an offline seat.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.unpinned"){
    if(!event.roleId){
      throw new KernelIntegrityError("Role unpin requires role id.",event.seq);
    }
    return true;
  }

  if(event.kind==="role.assigned"){
    if(!event.roleId||!event.seatId){
      throw new KernelIntegrityError("Role assignment requires role id and seat id.",event.seq);
    }
    if(state.seatStatus[event.seatId]==="offline"){
      throw new KernelIntegrityError("Cannot assign a role to an offline seat.",event.seq);
    }

    const pinned=state.pinnedAssignments[event.roleId];
    if(pinned&&pinned!==event.seatId){
      throw new KernelIntegrityError(
        "Assignment violates operator pin: "+event.roleId+" is pinned to "+pinned+".",
        event.seq
      );
    }

    if(event.assignmentOrigin!=="auto"&&event.assignmentOrigin!=="operator-pin"&&event.assignmentOrigin!=="bootstrap"){
      throw new KernelIntegrityError("Assignment event requires a valid origin.",event.seq);
    }

    if(event.assignmentScore===undefined||!Number.isFinite(event.assignmentScore)){
      throw new KernelIntegrityError("Assignment event requires a finite score.",event.seq);
    }

    if(!event.assignmentReason?.trim()){
      throw new KernelIntegrityError("Assignment event requires an explanation.",event.seq);
    }

    return true;
  }

  if(event.kind==="routing.completed"){
    if(event.source!=="system"){
      throw new KernelIntegrityError("Routing completion must be system-originated.",event.seq);
    }
    return true;
  }

  return false;
}

function assertPolicyEvent(state:ThinkTankState,event:ThinkTankEvent):void{
  if(assertDossierReleasePublicationAuditEvent(state,event))return;
  if(assertDossierReleasePublicationEvent(state,event))return;
  if(assertDossierReleaseTimestampEvent(state,event))return;
  if(assertDossierReleaseSealEvent(state,event))return;
  if(assertDossierReleaseEvent(state,event))return;
  if(assertDossierAssuranceEvent(state,event))return;
  if(assertDossierPublicationEvent(state,event))return;
  if(assertDossierTimestampEvent(state,event))return;
  if(assertDossierCheckpointWitnessEvent(state,event))return;
  if(assertDossierTransparencyEvent(state,event))return;
  if(assertDossierSealEvent(state,event))return;
  if(assertArgumentReviewEvent(state,event))return;
  if(assertExcerptEvent(state,event))return;
  if(assertClaimReviewEvent(state,event))return;
  if(assertResearchEvent(state,event))return;
  if(assertClaimEvent(state,event))return;
  if(assertEvidenceEvent(state,event))return;
  if(assertRoutingEvent(state,event))return;

  if(event.kind==="schedule.planned"){
    if(!event.turnPlan){
      throw new KernelIntegrityError("Schedule event is missing a turn plan.",event.seq);
    }

    const expected=initialTurnPlan(event.mode);
    if(stableStringify(event.turnPlan)!==stableStringify(expected)){
      throw new KernelIntegrityError("Schedule does not match the selected mode law.",event.seq);
    }
    return;
  }

  if(event.kind==="round.started"){
    if(!state.turnPlan)throw new KernelIntegrityError("Round started before a schedule was planned.",event.seq);
    if(event.round===undefined)throw new KernelIntegrityError("Round event is missing its round number.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("Cannot start a new round while a speaker is active.",event.seq);
    if(event.round!==state.currentRound+1){
      throw new KernelIntegrityError("Round discontinuity: expected "+(state.currentRound+1)+", received "+event.round+".",event.seq);
    }
    if(event.round>state.turnPlan.maxRounds){
      throw new KernelIntegrityError("Round cap exceeded for "+state.mode.toUpperCase()+".",event.seq);
    }
    if(state.currentRound>0&&state.speakerIndex<state.turnPlan.speakerQueue.length){
      throw new KernelIntegrityError("Cannot advance rounds before the scheduled queue completes.",event.seq);
    }
    return;
  }

  if(event.kind==="turn.started"){
    if(!state.turnPlan)throw new KernelIntegrityError("Turn started before a schedule was planned.",event.seq);
    if(state.currentRound<1)throw new KernelIntegrityError("Turn started before a round was opened.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("A second speaker cannot start while another turn is active.",event.seq);

    const expectedRole=state.turnPlan.speakerQueue[state.speakerIndex];
    if(!expectedRole)throw new KernelIntegrityError("Speaker queue is already complete.",event.seq);
    if(event.roleId!==expectedRole){
      throw new KernelIntegrityError(
        "Turn order violation: expected "+expectedRole+", received "+(event.roleId??"none")+".",
        event.seq
      );
    }
    return;
  }

  if(event.kind==="utterance.complete"||event.kind==="challenge.raised"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Utterance completed without an active speaker.",event.seq);
    }
    if(event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Utterance role mismatch: active speaker is "+state.currentSpeaker+".",event.seq);
    }
    if(event.kind==="challenge.raised"&&event.roleId!=="challenger"){
      throw new KernelIntegrityError("Only the Challenger role may emit challenge.raised.",event.seq);
    }
    return;
  }

  if(event.kind==="turn.timeout"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Timeout recorded without an active speaker.",event.seq);
    }
    if(event.roleId&&event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Timeout role does not match the active speaker.",event.seq);
    }
    return;
  }

  if(event.kind==="provider.failed"){
    if(!state.currentSpeaker){
      throw new KernelIntegrityError("Provider failure recorded without an active speaker.",event.seq);
    }
    if(event.roleId!==state.currentSpeaker){
      throw new KernelIntegrityError("Provider failure role does not match the active speaker.",event.seq);
    }
    if(!event.seatId){
      throw new KernelIntegrityError("Provider failure requires the responsible seat.",event.seq);
    }
    return;
  }

  if(event.kind==="gate.scored"){
    if(!state.turnPlan)throw new KernelIntegrityError("Reality Gate scored before a schedule was planned.",event.seq);
    if(state.currentSpeaker)throw new KernelIntegrityError("Reality Gate cannot score while a speaker is active.",event.seq);
    if(state.speakerIndex<state.turnPlan.speakerQueue.length){
      throw new KernelIntegrityError("Reality Gate cannot score before the scheduled queue completes.",event.seq);
    }
    if(event.gateScore===undefined||event.gateScore<0||event.gateScore>1){
      throw new KernelIntegrityError("Reality Gate score must be between 0 and 1.",event.seq);
    }

    if(event.gateBreakdown){
      const expected=evaluateEvidence(state);
      if(stableStringify(event.gateBreakdown)!==stableStringify(expected)){
        throw new KernelIntegrityError("Reality Gate breakdown does not match deterministic evidence evaluation.",event.seq);
      }
      if(event.gateScore!==expected.finalScore){
        throw new KernelIntegrityError(
          "Reality Gate score mismatch: expected "+expected.finalScore+", received "+event.gateScore+".",
          event.seq
        );
      }
    }
    return;
  }

  if(event.kind==="synthesis.completed"||event.kind==="synthesis.withheld"){
    if(!state.turnPlan)throw new KernelIntegrityError("Synthesis resolved before a schedule was planned.",event.seq);

    const expectedClaimGovernance=evaluateClaimGovernance(state,state.mode);
    if(!event.claimGovernance){
      throw new KernelIntegrityError("Synthesis resolution requires a claim governance receipt.",event.seq);
    }
    if(stableStringify(event.claimGovernance)!==stableStringify(expectedClaimGovernance)){
      throw new KernelIntegrityError("Claim governance receipt does not match deterministic recomputation.",event.seq);
    }

    const expectedArgumentGovernance=evaluateArgumentGovernance(state,state.mode);
    if(!event.argumentGovernance){
      throw new KernelIntegrityError("Synthesis resolution requires an argument governance receipt.",event.seq);
    }
    if(stableStringify(event.argumentGovernance)!==stableStringify(expectedArgumentGovernance)){
      throw new KernelIntegrityError("Argument governance receipt does not match deterministic recomputation.",event.seq);
    }

    const decision=evaluateGovernance(
      state.mode,
      state.gateScore??0,
      state.gateThreshold,
      state.objectionCount,
      Boolean(state.faultCode),
      expectedClaimGovernance,
      expectedArgumentGovernance
    );

    const expectedKind=decision.synthesisAllowed?"synthesis.completed":"synthesis.withheld";
    if(event.kind!==expectedKind){
      throw new KernelIntegrityError(
        "Governance violation: mode law requires "+expectedKind+", received "+event.kind+".",
        event.seq
      );
    }
    if(event.outputLabel!==decision.outputLabel){
      throw new KernelIntegrityError("Governance label mismatch: expected "+decision.outputLabel+".",event.seq);
    }
    if(Boolean(event.actionAllowed)!==decision.actionAllowed){
      throw new KernelIntegrityError("Action authorization contradicts the mode law.",event.seq);
    }
    if(event.governanceReason!==decision.reason){
      throw new KernelIntegrityError("Governance reason does not match deterministic mode-law decision.",event.seq);
    }

    const expectedDossier=buildSynthesisDecisionDossier(
      state,
      event.seq,
      event.kind==="synthesis.completed"?"completed":"withheld",
      decision.outputLabel,
      decision.actionAllowed,
      decision.reason
    );
    if(!event.decisionDossier){
      throw new KernelIntegrityError("Synthesis resolution requires a decision dossier.",event.seq);
    }
    if(stableStringify(event.decisionDossier)!==stableStringify(expectedDossier)){
      throw new KernelIntegrityError("Decision dossier does not match deterministic recomputation.",event.seq);
    }
    return;
  }

  if(event.kind==="operator.override"){
    if(event.source!=="operator"||event.override!==true){
      throw new KernelIntegrityError("Operator override must be an explicit operator-authorized event.",event.seq);
    }
    if(!state.synthesisWithheld&&!state.faultCode){
      throw new KernelIntegrityError("Operator override requires a withheld or faulted session.",event.seq);
    }

    const expectedReason=event.governanceReason??"Human operator explicitly overrode the withheld/faulted synthesis state.";
    const expectedLabel=state.mode==="audit"?"AUDIT":"STANDARD";
    if(event.outputLabel!==expectedLabel||event.actionAllowed!==true){
      throw new KernelIntegrityError("Operator override output/action fields contradict the override law.",event.seq);
    }
    let expectedOverride;
    try{
      expectedOverride=buildDecisionOverrideReceipt(state,event.seq,expectedLabel,expectedReason);
    }catch(error){
      throw new KernelIntegrityError(
        error instanceof Error?error.message:String(error),
        event.seq
      );
    }

    if(!event.decisionOverride||event.decisionDossierId!==expectedOverride.dossierId){
      throw new KernelIntegrityError("Operator override requires a linked decision override receipt.",event.seq);
    }
    if(stableStringify(event.decisionOverride)!==stableStringify(expectedOverride)){
      throw new KernelIntegrityError("Decision override receipt does not match deterministic recomputation.",event.seq);
    }
  }
}

export function buildEvent(state:ThinkTankState,input:ThinkTankEventInput):ThinkTankEvent{
  const stateBefore=fingerprintProjection(state);

  const draft:ThinkTankEvent={
    schemaVersion:1,
    sessionId:state.sessionId,
    seq:state.seq+1,
    seed:state.seed,
    source:input.source,
    mode:input.mode??state.mode,
    kind:input.kind,
    phase:input.phase??state.phase,
    roleId:input.roleId,
    seatId:input.seatId,
    seatStatus:input.seatStatus,
    assignmentScore:input.assignmentScore,
    assignmentReason:input.assignmentReason,
    assignmentOrigin:input.assignmentOrigin,
    providerModel:input.providerModel,
    providerLatencyMs:input.providerLatencyMs,
    providerRequestId:input.providerRequestId,
    claim:input.claim,
    claimId:input.claimId,
    claimBinding:input.claimBinding,
    claimBindingId:input.claimBindingId,
    claimReview:input.claimReview,
    argumentReview:input.argumentReview,
    argumentReviewId:input.argumentReviewId,
    researchQuery:input.researchQuery,
    researchReceipt:input.researchReceipt,
    researchCandidateId:input.researchCandidateId,
    evidenceRef:input.evidenceRef,
    evidenceId:input.evidenceId,
    evidenceUri:input.evidenceUri,
    evidenceExcerpt:input.evidenceExcerpt,
    evidenceExcerptId:input.evidenceExcerptId,
    excerptStart:input.excerptStart,
    excerptEnd:input.excerptEnd,
    gateBreakdown:input.gateBreakdown,
    claimGovernance:input.claimGovernance,
    argumentGovernance:input.argumentGovernance,
    decisionDossier:input.decisionDossier,
    decisionDossierId:input.decisionDossierId,
    decisionOverride:input.decisionOverride,
    dossierSeal:input.dossierSeal,
    dossierSealId:input.dossierSealId,
    dossierVerification:input.dossierVerification,
    dossierTransparency:input.dossierTransparency,
    dossierTransparencyId:input.dossierTransparencyId,
    dossierCheckpoint:input.dossierCheckpoint,
    dossierCheckpointId:input.dossierCheckpointId,
    dossierWitness:input.dossierWitness,
    dossierWitnessVerification:input.dossierWitnessVerification,
    dossierTimestamp:input.dossierTimestamp,
    dossierPublication:input.dossierPublication,
    provenancePolicy:input.provenancePolicy,
    provenanceAssurance:input.provenanceAssurance,
    provenanceAssuranceId:input.provenanceAssuranceId,
    dossierRelease:input.dossierRelease,
    dossierReleaseId:input.dossierReleaseId,
    dossierReleaseSeal:input.dossierReleaseSeal,
    dossierReleaseSealId:input.dossierReleaseSealId,
    dossierReleaseVerification:input.dossierReleaseVerification,
    dossierReleaseTimestamp:input.dossierReleaseTimestamp,
    dossierReleasePackageFingerprint:input.dossierReleasePackageFingerprint,
    dossierReleasePublication:input.dossierReleasePublication,
    dossierReleasePublicationId:input.dossierReleasePublicationId,
    dossierReleasePublicationAudit:input.dossierReleasePublicationAudit,
    message:input.message,
    gateScore:input.gateScore,
    override:input.override,
    turnPlan:input.turnPlan,
    round:input.round,
    faultCode:input.faultCode,
    outputLabel:input.outputLabel,
    actionAllowed:input.actionAllowed,
    governanceReason:input.governanceReason,
    stateBefore,
    stateAfter:"pending"
  };

  if(
    (draft.kind==="synthesis.completed"||draft.kind==="synthesis.withheld")&&
    !draft.decisionDossier
  ){
    const expectedClaimGovernance=evaluateClaimGovernance(state,state.mode);
    const expectedArgumentGovernance=evaluateArgumentGovernance(state,state.mode);
    const decision=evaluateGovernance(
      state.mode,
      state.gateScore??0,
      state.gateThreshold,
      state.objectionCount,
      Boolean(state.faultCode),
      expectedClaimGovernance,
      expectedArgumentGovernance
    );
    draft.decisionDossier=buildSynthesisDecisionDossier(
      state,
      draft.seq,
      draft.kind==="synthesis.completed"?"completed":"withheld",
      decision.outputLabel,
      decision.actionAllowed,
      decision.reason
    );
  }

  if(draft.kind==="operator.override"&&!draft.decisionOverride){
    const reason=draft.governanceReason??"Human operator explicitly overrode the withheld/faulted synthesis state.";
    const label=draft.outputLabel??(state.mode==="audit"?"AUDIT":"STANDARD");
    const receipt=buildDecisionOverrideReceipt(state,draft.seq,label,reason);
    draft.decisionOverride=receipt;
    draft.decisionDossierId=receipt.dossierId;
  }

  assertPolicyEvent(state,draft);
  const projected=projectEvent(state,draft);

  return {...draft,stateAfter:fingerprintProjection(projected)};
}

export function buildEventBatch(state:ThinkTankState,inputs:ThinkTankEventInput[]):ThinkTankEvent[]{
  const events:ThinkTankEvent[]=[];
  let projected=state;

  for(const input of inputs){
    const event=buildEvent(projected,input);
    events.push(event);
    projected=projectEvent(projected,event);
  }

  return events;
}

export function applyVerifiedEvent(state:ThinkTankState,event:ThinkTankEvent):ThinkTankState{
  if(event.schemaVersion!==1){
    throw new KernelIntegrityError("Unsupported event schema version.",event.seq);
  }

  if(event.sessionId!==state.sessionId){
    throw new KernelIntegrityError(
      "Session mismatch at seq "+event.seq+": expected "+state.sessionId+", received "+event.sessionId+".",
      event.seq
    );
  }

  if(event.seed!==state.seed){
    throw new KernelIntegrityError(
      "Seed mismatch at seq "+event.seq+": expected "+state.seed+", received "+event.seed+".",
      event.seq
    );
  }

  const expectedSeq=state.seq+1;
  if(event.seq!==expectedSeq){
    throw new KernelIntegrityError("Sequence discontinuity: expected "+expectedSeq+", received "+event.seq+".",event.seq);
  }

  const actualBefore=fingerprintProjection(state);
  if(event.stateBefore!==actualBefore){
    throw new KernelIntegrityError("Pre-state fingerprint mismatch at seq "+event.seq+".",event.seq);
  }

  assertPolicyEvent(state,event);
  const projected=projectEvent(state,event);
  const actualAfter=fingerprintProjection(projected);

  if(event.stateAfter!==actualAfter){
    throw new KernelIntegrityError("Post-state fingerprint mismatch at seq "+event.seq+".",event.seq);
  }

  return projected;
}

export function replayEvents(initialState:ThinkTankState,events:ThinkTankEvent[]):ThinkTankState{
  return events.reduce((state,event)=>applyVerifiedEvent(state,event),initialState);
}

export function verifyReplay(
  initialState:ThinkTankState,
  events:ThinkTankEvent[],
  expectedState?:ThinkTankState
):ReplayReport{
  try{
    const replayed=replayEvents(initialState,events);
    const finalFingerprint=fingerprintProjection(replayed);
    const expectedFingerprint=expectedState?fingerprintProjection(expectedState):undefined;

    return {
      valid:true,
      exact:expectedFingerprint===undefined||finalFingerprint===expectedFingerprint,
      eventCount:events.length,
      finalFingerprint,
      expectedFingerprint
    };
  }catch(error){
    return {
      valid:false,
      exact:false,
      eventCount:events.length,
      finalFingerprint:"",
      expectedFingerprint:expectedState?fingerprintProjection(expectedState):undefined,
      error:error instanceof Error?error.message:String(error)
    };
  }
}
