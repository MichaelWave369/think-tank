import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {
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
  signedAt:"2026-10-02T07:20:00.000Z",
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
  verifiedAt:"2026-10-02T07:20:01.000Z"
};

const baseState=(verified=true):ThinkTankState=>({
  ...createInitialState(),
  phase:"complete",
  dossierReleaseManifests:[manifest],
  dossierReleaseSeals:[seal],
  dossierReleaseSealVerifications:verified?[verification]:[]
});

const receipt=(state:ThinkTankState):DossierReleasePublicationReceipt=>{
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
    publisherClaimedAt:"2026-10-02T07:21:00.000Z",
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T07:21:01.000Z",
    releaseSealIds:[seal.id],
    releaseVerificationIds:[verification.id],
    releaseTimestampIds:[],
    artifactIds:[],
    receiptSha256,
    trust:"externally-retrieved-release-publication"
  };
};

describe("verified release publication kernel",()=>{
  it("accepts and exactly replays RPUB for the pinned package basis",()=>{
    let state=baseState();
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    });
    state=projectEvent(state,request);
    const pub=receipt(state);
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      dossierReleasePublication:pub,
      message:"published"
    });
    state=projectEvent(state,complete);

    expect(state.dossierReleasePublications).toEqual([pub]);
    const replayed=replayEvents(baseState(),[request,complete]);
    expect(replayed.dossierReleasePublications).toEqual([pub]);
  });

  it("rejects publication request without a verified release seal",()=>{
    const state=baseState(false);
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    })).toThrow(/requires at least one successfully verified release seal/i);
  });

  it("rejects forged RPUB linkage",()=>{
    let state=baseState();
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    });
    state=projectEvent(state,request);
    const forged={...receipt(state),manifestSha256:"0".repeat(64)};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      dossierReleasePublication:forged,
      message:"published"
    })).toThrow(/does not match the pinned canonical release package/i);
  });

  it("rejects completion if canonical package changed after operator request",()=>{
    let state=baseState();
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    });
    state=projectEvent(state,request);

    state={
      ...state,
      dossierReleaseRfc3161Timestamps:[{
        id:"RTSA-"+seal.id+"-"+"e".repeat(12),
        releaseId:manifest.id,
        sealId:seal.id,
        tool:"rfc3161-release-seal-timestamp-verifier",
        standard:"RFC3161",
        hashAlgorithm:"SHA-256",
        releaseSealSha256:"f".repeat(64),
        manifestSha256:seal.manifestSha256,
        publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
        tokenSha256:"e".repeat(64),
        tokenBase64:"AQID",
        tsaPolicyOid:"1.2.3",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-02T07:20:30.000Z",
        tsaSubject:"CN=TSA",
        authorityUrl:"https://tsa.example.test/",
        trustAnchorSha256:"1".repeat(64),
        verifiedAt:"2026-10-02T07:20:31.000Z",
        trust:"configured-rfc3161-trust-anchor"
      }]
    };

    const oldReceipt={
      ...receipt(baseState()),
      packageBasisFingerprint:fingerprint
    };

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      dossierReleasePublication:oldReceipt,
      message:"published"
    })).toThrow(/does not match the pinned canonical release package/i);
  });

  it("rejects duplicate same-publisher publication for the same package basis",()=>{
    let state=baseState();
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    });
    state=projectEvent(state,request);
    const pub=receipt(state);
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      dossierReleasePublication:pub,
      message:"published"
    });
    state=projectEvent(state,complete);

    const request2=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish again"
    });
    state=projectEvent(state,request2);

    const pub2={...pub,id:"RPUB-"+manifest.id+"-"+"e".repeat(12),receiptSha256:"e".repeat(64),publicationId:"pub-2"};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.publication.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      dossierReleasePublication:pub2,
      message:"published again"
    })).toThrow(/already published through this publisher/i);
  });

  it("locks release publication during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};
    const fingerprint=releasePackageBasisFingerprint(state,manifest.id);

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.publication.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleasePackageFingerprint:fingerprint,
      message:"publish"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
