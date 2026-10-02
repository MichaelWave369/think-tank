import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {
  DossierReleaseManifest,
  DossierReleaseRfc3161TimestampReceipt,
  DossierReleaseSealReceipt,
  DossierReleaseSealVerificationReceipt,
  ThinkTankState
} from "./types";
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
  artifactIds:[
    "ASSURE-DOS-0001-integrity-cafebabe",
    "CHK-000001-123456789abc",
    "DOS-0001"
  ],
  manifestFingerprint:"fnv1a32:deadbeef",
  releaseAuthority:"fresh-passing-provenance-policy",
  truthAuthority:false
};

const releaseSeal:DossierReleaseSealReceipt={
  id:"RSEAL-"+manifest.id+"-"+"a".repeat(12),
  releaseId:manifest.id,
  dossierId:manifest.dossierId,
  tool:"ed25519-release-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  manifestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:"a".repeat(64),
  signatureBase64:"AQIDBAUG",
  signedAt:"2026-10-02T06:10:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"release-test",
  trust:"self-attested-local-release-key"
};

const releaseVerification:DossierReleaseSealVerificationReceipt={
  id:"RVER-"+releaseSeal.id,
  releaseId:manifest.id,
  sealId:releaseSeal.id,
  tool:"ed25519-release-verifier",
  algorithm:"Ed25519",
  manifestSha256:releaseSeal.manifestSha256,
  publicKeyFingerprintSha256:releaseSeal.publicKeyFingerprintSha256,
  verified:true,
  verifiedAt:"2026-10-02T06:10:01.000Z"
};

const timestamp=(tokenSha="c".repeat(64)):DossierReleaseRfc3161TimestampReceipt=>({
  id:"RTSA-"+releaseSeal.id+"-"+tokenSha.slice(0,12),
  releaseId:manifest.id,
  sealId:releaseSeal.id,
  tool:"rfc3161-release-seal-timestamp-verifier",
  standard:"RFC3161",
  hashAlgorithm:"SHA-256",
  releaseSealSha256:"d".repeat(64),
  manifestSha256:releaseSeal.manifestSha256,
  publicKeyFingerprintSha256:releaseSeal.publicKeyFingerprintSha256,
  tokenSha256:tokenSha,
  tokenBase64:"AQIDBAUG",
  tsaPolicyOid:"1.2.3.4.6",
  tsaSerialNumber:"0xBEEF",
  genTime:"2026-10-02T06:11:00.000Z",
  tsaSubject:"CN=Release TSA",
  authorityUrl:"https://tsa.example.test/",
  trustAnchorSha256:"e".repeat(64),
  verifiedAt:"2026-10-02T06:11:01.000Z",
  trust:"configured-rfc3161-trust-anchor"
});

const baseState=(verified=true):ThinkTankState=>({
  ...createInitialState(),
  phase:"complete",
  dossierReleaseManifests:[manifest],
  dossierReleaseSeals:[releaseSeal],
  dossierReleaseSealVerifications:verified?[releaseVerification]:[]
});

describe("RFC3161 release timestamp kernel",()=>{
  it("accepts and exactly replays trusted release timestamp receipts",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp release seal"
    });
    state=projectEvent(state,request);

    const receipt=timestamp();
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.timestamp.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      dossierReleaseTimestamp:receipt,
      message:"timestamped"
    });
    state=projectEvent(state,complete);

    expect(state.dossierReleaseRfc3161Timestamps).toEqual([receipt]);

    const replayed=replayEvents(baseState(),[request,complete]);
    expect(replayed.dossierReleaseRfc3161Timestamps).toEqual([receipt]);
  });

  it("rejects timestamp request before release seal verification",()=>{
    const state=baseState(false);

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp release seal"
    })).toThrow(/requires a successfully verified release seal/i);
  });

  it("rejects forged timestamp linkage to the release seal",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp release seal"
    });
    state=projectEvent(state,request);
    const forged={...timestamp(),manifestSha256:"0".repeat(64)};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.timestamp.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      dossierReleaseTimestamp:forged,
      message:"timestamped"
    })).toThrow(/does not match its verified release seal/i);
  });

  it("rejects duplicate TSA/trust-anchor attestation for the same release seal",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp"
    });
    state=projectEvent(state,request);

    const first=timestamp();
    const complete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.timestamp.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      dossierReleaseTimestamp:first,
      message:"timestamped"
    });
    state=projectEvent(state,complete);

    const secondRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp again"
    });
    state=projectEvent(state,secondRequest);

    const second=timestamp("f".repeat(64));
    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.timestamp.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      dossierReleaseTimestamp:second,
      message:"timestamped again"
    })).toThrow(/already has a timestamp/i);
  });

  it("rejects completion without a matching operator request",()=>{
    const state=baseState();

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.timestamp.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      dossierReleaseTimestamp:timestamp(),
      message:"timestamped"
    })).toThrow(/no matching operator request/i);
  });

  it("locks release timestamping during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.timestamp.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:releaseSeal.id,
      message:"timestamp"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
