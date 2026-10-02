import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {
  DossierReleaseManifest,
  DossierReleasePublicationAuditReceipt,
  DossierReleasePublicationReceipt,
  DossierReleaseSealReceipt,
  DossierReleaseSealVerificationReceipt,
  ThinkTankState
} from "./types";
import {releasePackageBasisFingerprint} from "./releasePackage";
import {evaluateReleaseAvailabilityAssurance} from "./releaseAvailabilityAssurance";
import {buildEvent,replayEvents} from "../kernel/eventKernel";

const manifest:DossierReleaseManifest={
  schemaVersion:1,
  id:"REL-DOS-0001-integrity-deadbeef",
  dossierId:"DOS-0001",
  policy:"integrity",
  assuranceReportId:"ASSURE-DOS-0001-integrity-cafebabe",
  assuranceBasisFingerprint:"fnv1a32:cafebabe",
  checkpointId:"CHK-000001-123456789abc",
  operatorOverrideId:"",
  artifactIds:[],
  manifestFingerprint:"fnv1a32:deadbeef",
  releaseAuthority:"fresh-passing-provenance-policy",
  truthAuthority:false
};

const seal:DossierReleaseSealReceipt={
  id:"RSEAL-"+manifest.id+"-"+"a".repeat(12),
  releaseId:manifest.id,
  dossierId:manifest.dossierId,
  tool:"ed25519-release-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  manifestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:"a".repeat(64),
  signatureBase64:"AQID",
  signedAt:"2026-10-02T11:00:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"test",
  trust:"self-attested-local-release-key"
};

const verification:DossierReleaseSealVerificationReceipt={
  id:"RVER-"+seal.id,
  releaseId:manifest.id,
  sealId:seal.id,
  tool:"ed25519-release-verifier",
  algorithm:"Ed25519",
  manifestSha256:seal.manifestSha256,
  publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
  verified:true,
  verifiedAt:"2026-10-02T11:00:01.000Z"
};

const packageSha="c".repeat(64);

const baseWithoutPublication=():ThinkTankState=>({
  ...createInitialState(),
  phase:"complete",
  dossierReleaseManifests:[manifest],
  dossierReleaseSeals:[seal],
  dossierReleaseSealVerifications:[verification]
});

const publication=():DossierReleasePublicationReceipt=>{
  const state=baseWithoutPublication();
  const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
  const receiptSha256="d".repeat(64);
  return {
    id:"RPUB-"+manifest.id+"-"+receiptSha256.slice(0,12),
    releaseId:manifest.id,
    tool:"verified-release-package-publisher",
    protocol:"phi-release-publication-v1",
    packageBasisFingerprint:fingerprint,
    manifestSha256:seal.manifestSha256,
    packageSha256:packageSha,
    publisherUrl:"https://publisher.example.test/publish",
    retrievalUrl:"https://public.example.test/releases/pkg.json",
    publicationId:"pub-1",
    publisherClaimedAt:"2026-10-02T11:01:00.000Z",
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T11:01:01.000Z",
    releaseSealIds:[seal.id],
    releaseVerificationIds:[verification.id],
    releaseTimestampIds:[],
    artifactIds:[],
    receiptSha256,
    trust:"externally-retrieved-release-publication"
  };
};

const audit=():DossierReleasePublicationAuditReceipt=>{
  const pub=publication();
  const receiptSha256="e".repeat(64);
  return {
    id:"RAUD-"+pub.id+"-"+receiptSha256.slice(0,12),
    releaseId:manifest.id,
    publicationReceiptId:pub.id,
    publicationReceiptSha256:pub.receiptSha256,
    tool:"release-publication-durability-auditor",
    protocol:"phi-release-publication-audit-v1",
    packageBasisFingerprint:pub.packageBasisFingerprint,
    packageSha256:pub.packageSha256,
    retrievalUrl:pub.retrievalUrl,
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    checkedAt:"2026-10-02T12:00:00.000Z",
    clock:"untrusted-local-clock",
    readbackSha256:pub.packageSha256,
    exactMatch:true,
    receiptSha256,
    trust:"repeat-external-retrieval"
  };
};

const baseState=():ThinkTankState=>({
  ...baseWithoutPublication(),
  dossierReleasePublications:[publication()],
  dossierReleasePublicationAudits:[audit()]
});

describe("release availability assurance kernel",()=>{
  it("accepts and exactly replays deterministic RAVA report",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      message:"evaluate availability"
    });
    state=projectEvent(state,request);

    const report=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    const complete=buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:report,
      message:"availability evaluated"
    });
    state=projectEvent(state,complete);

    expect(state.dossierReleaseAvailabilityAssurances).toEqual([report]);
    const replayed=replayEvents(baseState(),[request,complete]);
    expect(replayed.dossierReleaseAvailabilityAssurances).toEqual([report]);
  });

  it("rejects request for package without RPUB evidence",()=>{
    const state=baseState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:"9".repeat(64),
      releaseAvailabilityPolicy:"published",
      message:"evaluate"
    })).toThrow(/requires an existing RPUB/i);
  });

  it("rejects forged system report",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      message:"evaluate"
    });
    state=projectEvent(state,request);

    const expected=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    const forged={...expected,passed:false,reason:"forged"};

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:forged,
      message:"evaluate"
    })).toThrow(/does not match deterministic recomputation/i);
  });

  it("rejects authority escalation",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      message:"evaluate"
    });
    state=projectEvent(state,request);

    const expected=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    const forged={
      ...expected,
      truthAuthority:true
    } as unknown as typeof expected;

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:forged,
      message:"evaluate"
    })).toThrow();
  });

  it("rejects completion without matching operator request",()=>{
    const state=baseState();
    const report=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:report,
      message:"evaluate"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects duplicate report for same package policy basis",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      message:"evaluate"
    });
    state=projectEvent(state,request);
    const report=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    const complete=buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:report,
      message:"evaluate"
    });
    state=projectEvent(state,complete);

    const request2=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      message:"evaluate again"
    });
    state=projectEvent(state,request2);

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"dossier.release.availability.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"rechecked",
      releaseAvailabilityAssurance:report,
      message:"evaluate"
    })).toThrow(/already has an assurance report/i);
  });

  it("locks availability assurance during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.availability.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      releaseAvailabilityPackageSha256:packageSha,
      releaseAvailabilityPolicy:"published",
      message:"evaluate"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
