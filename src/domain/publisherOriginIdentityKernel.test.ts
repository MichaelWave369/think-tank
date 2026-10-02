import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {
  DossierPublisherOriginIdentityReceipt,
  DossierReleaseManifest,
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
  signedAt:"2026-10-02T13:10:00.000Z",
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
  verifiedAt:"2026-10-02T13:10:01.000Z"
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
  const packageBasisFingerprint=releasePackageBasisFingerprint(state,manifest.id);
  const receiptSha256="d".repeat(64);
  return {
    id:"RPUB-"+manifest.id+"-"+receiptSha256.slice(0,12),
    releaseId:manifest.id,
    tool:"verified-release-package-publisher",
    protocol:"phi-release-publication-v1",
    packageBasisFingerprint,
    manifestSha256:seal.manifestSha256,
    packageSha256:"c".repeat(64),
    publisherUrl:"https://publisher.example.test/publish",
    retrievalUrl:"https://public.example.test/releases/pkg.json",
    publicationId:"pub-1",
    publisherClaimedAt:"2026-10-02T13:11:00.000Z",
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T13:11:01.000Z",
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

const identity=(
  descriptorSha256="e".repeat(64),
  keyFingerprint="f".repeat(64),
  receiptSha256="1".repeat(64)
):DossierPublisherOriginIdentityReceipt=>{
  const pub=publication();
  return {
    id:"POID-"+pub.id+"-"+receiptSha256.slice(0,12),
    releaseId:manifest.id,
    publicationReceiptId:pub.id,
    publicationReceiptSha256:pub.receiptSha256,
    tool:"publisher-origin-identity-verifier",
    protocol:"phi-publisher-identity-v1",
    retrievalOrigin:"https://public.example.test",
    identityUrl:"https://public.example.test/.well-known/phi-publisher-identity.json",
    descriptorSha256,
    publisherId:"publisher-example",
    publisherLabel:"Example Publisher",
    administrativeDomainClaim:"example-publishing-admin",
    publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    publicKeyFingerprintSha256:keyFingerprint,
    claimedAt:"2026-10-02T13:12:00.000Z",
    signatureBase64:"AQIDBAUG",
    verified:true,
    verifiedAt:"2026-10-02T13:12:01.000Z",
    clock:"untrusted-local-clock",
    receiptSha256,
    trust:"self-attested-origin-signing-key",
    realWorldIdentityAuthority:false,
    operatorIndependenceAuthority:false,
    truthAuthority:false
  };
};

describe("publisher-origin identity kernel",()=>{
  it("accepts and exactly replays POID receipt",()=>{
    let state=baseState();
    const pub=publication();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify identity"
    });
    state=projectEvent(state,request);

    const value=identity();
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:value,
      message:"identity verified"
    });
    state=projectEvent(state,complete);

    expect(state.dossierPublisherOriginIdentities).toEqual([value]);
    const replayed=replayEvents(baseState(),[request,complete]);
    expect(replayed.dossierPublisherOriginIdentities).toEqual([value]);
  });

  it("rejects request for unknown RPUB",()=>{
    const state=baseState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:"RPUB-UNKNOWN",
      message:"verify identity"
    })).toThrow(/requires an existing RPUB/i);
  });

  it("rejects forged origin or authority flags",()=>{
    let state=baseState();
    const pub=publication();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify identity"
    });
    state=projectEvent(state,request);

    const forged={
      ...identity(),
      retrievalOrigin:"https://other.example.test",
      realWorldIdentityAuthority:true
    } as unknown as DossierPublisherOriginIdentityReceipt;

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:forged,
      message:"identity verified"
    })).toThrow(/does not match its RPUB origin identity contract/i);
  });

  it("rejects duplicate exact descriptor after fresh request",()=>{
    let state=baseState();
    const pub=publication();

    const request1=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify 1"
    });
    state=projectEvent(state,request1);
    const first=identity();
    state=projectEvent(state,buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:first,
      message:"verified 1"
    }));

    const request2=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify 2"
    });
    state=projectEvent(state,request2);

    const duplicate=identity("e".repeat(64),"f".repeat(64),"2".repeat(64));
    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:duplicate,
      message:"verified duplicate"
    })).toThrow(/exact publisher-origin identity descriptor was already accepted/i);
  });

  it("allows a new descriptor/key rotation after a fresh request",()=>{
    let state=baseState();
    const pub=publication();

    state=projectEvent(state,buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify 1"
    }));
    const first=identity();
    state=projectEvent(state,buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:first,
      message:"verified 1"
    }));

    state=projectEvent(state,buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify rotated"
    }));
    const rotated=identity("2".repeat(64),"3".repeat(64),"4".repeat(64));
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:rotated,
      message:"verified rotated"
    });
    state=projectEvent(state,complete);

    expect(state.dossierPublisherOriginIdentities).toEqual([first,rotated]);
  });

  it("rejects completion without matching operator request",()=>{
    const state=baseState();
    const pub=publication();

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publisher.identity.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      dossierPublisherIdentity:identity(),
      message:"identity verified"
    })).toThrow(/no matching operator request/i);
  });

  it("locks publisher identity verification during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};
    const pub=publication();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publisher.identity.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierPublisherIdentityPublicationId:pub.id,
      message:"verify identity"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
