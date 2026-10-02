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
  signedAt:"2026-10-02T08:10:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"release-test",
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
  verifiedAt:"2026-10-02T08:10:01.000Z"
};

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
    packageSha256:"c".repeat(64),
    publisherUrl:"https://publisher.example.test/publish",
    retrievalUrl:"https://public.example.test/releases/pkg.json",
    publicationId:"pub-1",
    publisherClaimedAt:"2026-10-02T08:11:00.000Z",
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T08:11:01.000Z",
    releaseSealIds:[seal.id],
    releaseVerificationIds:[verification.id],
    releaseTimestampIds:[],
    artifactIds:[],
    receiptSha256,
    trust:"externally-retrieved-release-publication"
  };
};

const baseState=():ThinkTankState=>({
  ...baseWithoutPublication(),
  dossierReleasePublications:[publication()]
});

const audit=(receiptSha256="e".repeat(64),checkedAt="2026-10-02T09:00:00.000Z"):DossierReleasePublicationAuditReceipt=>{
  const pub=publication();
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
    checkedAt,
    clock:"untrusted-local-clock",
    readbackSha256:pub.packageSha256,
    exactMatch:true,
    receiptSha256,
    trust:"repeat-external-retrieval"
  };
};

describe("release publication durability kernel",()=>{
  it("accepts and exactly replays RAUD for an existing historical RPUB",()=>{
    let state=baseState();
    const pub=publication();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      message:"audit publication"
    });
    state=projectEvent(state,request);

    const value=audit();
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.audit.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      dossierReleasePublicationAudit:value,
      message:"still available"
    });
    state=projectEvent(state,complete);

    expect(state.dossierReleasePublicationAudits).toEqual([value]);
    const replayed=replayEvents(baseState(),[request,complete]);
    expect(replayed.dossierReleasePublicationAudits).toEqual([value]);
  });

  it("rejects audit request for an unknown RPUB",()=>{
    const state=baseState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:"RPUB-UNKNOWN",
      message:"audit"
    })).toThrow(/requires an existing RPUB/i);
  });

  it("rejects forged RAUD package linkage",()=>{
    let state=baseState();
    const pub=publication();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      message:"audit"
    });
    state=projectEvent(state,request);
    const forged={...audit(),readbackSha256:"0".repeat(64)};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.audit.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      dossierReleasePublicationAudit:forged,
      message:"audit"
    })).toThrow(/does not match its historical RPUB package/i);
  });

  it("allows repeated successful audits after fresh operator requests",()=>{
    let state=baseState();
    const pub=publication();

    const request1=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      message:"audit 1"
    });
    state=projectEvent(state,request1);
    const audit1=audit();
    const complete1=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.audit.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      dossierReleasePublicationAudit:audit1,
      message:"audit 1 complete"
    });
    state=projectEvent(state,complete1);

    const request2=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      message:"audit 2"
    });
    state=projectEvent(state,request2);
    const audit2=audit("f".repeat(64),"2026-10-03T09:00:00.000Z");
    const complete2=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.audit.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      dossierReleasePublicationAudit:audit2,
      message:"audit 2 complete"
    });
    state=projectEvent(state,complete2);

    expect(state.dossierReleasePublicationAudits).toEqual([audit1,audit2]);
  });

  it("rejects completion without a matching operator request",()=>{
    const state=baseState();
    const pub=publication();

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.audit.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      dossierReleasePublicationAudit:audit(),
      message:"audit"
    })).toThrow(/no matching operator request/i);
  });

  it("locks durability audits during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};
    const pub=publication();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.audit.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePublicationId:pub.id,
      message:"audit"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
