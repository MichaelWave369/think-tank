import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import type {
  DossierProvenanceAssuranceReport,
  DossierSealReceipt,
  DossierSealVerificationReceipt,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt,
  ThinkTankState
} from "./types";
import {evaluateProvenanceAssurance} from "./provenanceAssurance";
import {buildDossierReleaseManifest} from "./releaseManifest";
import {buildEvent,projectEvent,replayEvents} from "../kernel/eventKernel";

const releaseBase=()=>{
  const initial=createInitialState();
  const dossier={
    id:"DOS-0001",
    sessionId:initial.sessionId,
    seed:initial.seed,
    decisionSeq:1,
    mode:initial.mode,
    operatorPrompt:"Release kernel test",
    outcome:"completed" as const,
    outputLabel:"STANDARD" as const,
    actionAllowed:true,
    gateScore:.9,
    gateThreshold:.75,
    gateBreakdown:null,
    claimGovernance:{
      mode:initial.mode,policy:"informational" as const,applicableClaimIds:[],
      freshClaimIds:[],missingReviewClaimIds:[],staleReviewClaimIds:[],
      coverageBlockedClaimIds:[],passed:true,reason:"test"
    },
    argumentGovernance:{
      mode:initial.mode,policy:"informational" as const,applicableClaimIds:[],
      freshAcceptedClaimIds:[],missingAcceptedClaimIds:[],staleAcceptedClaimIds:[],
      draftOnlyClaimIds:[],passed:true,reason:"test"
    },
    objectionCount:0,
    faultCode:"",
    assignments:[],
    claims:[],
    bindings:[],
    evidence:[],
    excerpts:[],
    claimReviews:[],
    argumentReviews:[],
    providerTurns:[],
    basisFingerprint:"fnv1a32:11111111",
    governanceReason:"test"
  };
  const seal:DossierSealReceipt={
    id:"SEAL-"+dossier.id+"-"+"a".repeat(12),
    dossierId:dossier.id,
    tool:"ed25519-dossier-sealer",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    digestSha256:"b".repeat(64),
    publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    publicKeyFingerprintSha256:"a".repeat(64),
    signatureBase64:"AQID",
    signedAt:"2026-10-02T04:10:00.000Z",
    signerLabel:"test",
    trust:"self-attested-local-key"
  };
  const verification:DossierSealVerificationReceipt={
    id:"DVER-"+seal.id,
    dossierId:dossier.id,
    sealId:seal.id,
    tool:"ed25519-dossier-verifier",
    algorithm:"Ed25519",
    digestSha256:seal.digestSha256,
    publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
    verified:true,
    verifiedAt:"2026-10-02T04:10:01.000Z"
  };
  const entry:DossierTransparencyReceipt={
    id:"TLOG-000001-"+"c".repeat(12),
    dossierId:dossier.id,
    sealId:seal.id,
    tool:"sha256-dossier-transparency-journal",
    canonicalization:"json-stable-v1",
    sequence:1,
    previousEntrySha256:"0".repeat(64),
    entrySha256:"c".repeat(64),
    dossierSha256:seal.digestSha256,
    publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
    loggedAt:"2026-10-02T04:11:00.000Z",
    clock:"untrusted-local-clock",
    trust:"tamper-evident-local-journal",
    journalVerifiedAtAppend:true
  };
  const checkpoint:DossierTransparencyCheckpoint={
    id:"CHK-000001-"+"d".repeat(12),
    tool:"sha256-transparency-checkpoint",
    canonicalization:"json-stable-v1",
    entryCount:1,
    headEntryId:entry.id,
    headSha256:entry.entrySha256,
    checkpointSha256:"d".repeat(64),
    createdAt:"2026-10-02T04:12:00.000Z",
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };
  let state:ThinkTankState={
    ...initial,
    phase:"complete",
    decisionDossiers:[dossier],
    dossierSeals:[seal],
    dossierSealVerifications:[verification],
    dossierTransparencyEntries:[entry],
    dossierTransparencyCheckpoints:[checkpoint]
  };
  const assurance=evaluateProvenanceAssurance(state,dossier.id,"integrity");
  state={...state,dossierProvenanceAssurances:[assurance]};

  return {state,dossier,assurance,checkpoint};
};

describe("assurance-gated release kernel",()=>{
  it("authorizes and exactly replays a deterministic release manifest",()=>{
    const base=releaseBase();
    const request=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      message:"release"
    });
    const requested=projectEvent(base.state,request);
    const manifest=buildDossierReleaseManifest(
      requested,
      base.dossier.id,
      "integrity",
      base.assurance.id
    );
    const authorized=buildEvent(requested,{
      source:"system",
      kind:"dossier.release.authorized",
      phase:requested.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      dossierRelease:manifest,
      message:"authorized"
    });
    const final=projectEvent(requested,authorized);

    expect(final.dossierReleaseManifests).toEqual([manifest]);

    const replayed=replayEvents(base.state,[request,authorized]);
    expect(replayed.dossierReleaseManifests).toEqual([manifest]);
  });

  it("rejects a forged manifest",()=>{
    const base=releaseBase();
    const request=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      message:"release"
    });
    const requested=projectEvent(base.state,request);
    const manifest=buildDossierReleaseManifest(
      requested,
      base.dossier.id,
      "integrity",
      base.assurance.id
    );
    const forged={...manifest,artifactIds:[...manifest.artifactIds,"FAKE-ARTIFACT"]};

    expect(()=>buildEvent(requested,{
      source:"system",
      kind:"dossier.release.authorized",
      phase:requested.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      dossierRelease:forged,
      message:"forged"
    })).toThrow(/does not match deterministic recomputation/i);
  });

  it("rejects authorization without an operator request",()=>{
    const base=releaseBase();
    const manifest=buildDossierReleaseManifest(
      base.state,
      base.dossier.id,
      "integrity",
      base.assurance.id
    );

    expect(()=>buildEvent(base.state,{
      source:"system",
      kind:"dossier.release.authorized",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      dossierRelease:manifest,
      message:"authorized"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects release requests backed by failed assurance",()=>{
    const base=releaseBase();
    const failed:DossierProvenanceAssuranceReport={
      ...base.assurance,
      id:"ASSURE-"+base.dossier.id+"-full-provenance-deadbeef",
      policy:"full-provenance",
      passed:false,
      missing:["verified-witness","rfc3161-time","verified-publication"],
      reason:"missing",
      truthAuthority:false
    };
    const state={...base.state,dossierProvenanceAssurances:[failed]};

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"full-provenance",
      provenanceAssuranceId:failed.id,
      message:"release"
    })).toThrow(/fresh passing assurance/i);
  });

  it("rejects duplicate release for the same assurance basis",()=>{
    const base=releaseBase();
    const request=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      message:"release"
    });
    let state=projectEvent(base.state,request);
    const manifest=buildDossierReleaseManifest(
      state,
      base.dossier.id,
      "integrity",
      base.assurance.id
    );
    const authorized=buildEvent(state,{
      source:"system",
      kind:"dossier.release.authorized",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      dossierRelease:manifest,
      message:"authorized"
    });
    state=projectEvent(state,authorized);

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      message:"release again"
    })).toThrow(/already has a release manifest/i);
  });

  it("locks release during active governed execution",()=>{
    const base=releaseBase();
    const active={...base.state,phase:"independent" as const};

    expect(()=>buildEvent(active,{
      source:"operator",
      kind:"dossier.release.requested",
      phase:active.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssuranceId:base.assurance.id,
      message:"release"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
