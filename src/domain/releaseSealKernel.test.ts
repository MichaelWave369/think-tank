import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {
  DossierReleaseManifest,
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

const baseState=():ThinkTankState=>({
  ...createInitialState(),
  phase:"complete",
  dossierReleaseManifests:[manifest]
});

const seal=(fingerprint="a".repeat(64)):DossierReleaseSealReceipt=>({
  id:"RSEAL-"+manifest.id+"-"+fingerprint.slice(0,12),
  releaseId:manifest.id,
  dossierId:manifest.dossierId,
  tool:"ed25519-release-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  manifestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:fingerprint,
  signatureBase64:"AQIDBAUG",
  signedAt:"2026-10-02T05:10:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"test-release-key",
  trust:"self-attested-local-release-key"
});

const verification=(s:DossierReleaseSealReceipt):DossierReleaseSealVerificationReceipt=>({
  id:"RVER-"+s.id,
  releaseId:manifest.id,
  sealId:s.id,
  tool:"ed25519-release-verifier",
  algorithm:"Ed25519",
  manifestSha256:s.manifestSha256,
  publicKeyFingerprintSha256:s.publicKeyFingerprintSha256,
  verified:true,
  verifiedAt:"2026-10-02T05:10:01.000Z"
});

describe("cryptographic release seal kernel",()=>{
  it("accepts and exactly replays release seal + verification receipts",()=>{
    let state=baseState();
    const sealRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal release"
    });
    state=projectEvent(state,sealRequest);

    const s=seal();
    const sealComplete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:s,
      message:"sealed"
    });
    state=projectEvent(state,sealComplete);

    const verifyRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.verify.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:s.id,
      message:"verify"
    });
    state=projectEvent(state,verifyRequest);

    const verified=verification(s);
    const verifyComplete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.verify.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:s.id,
      dossierReleaseVerification:verified,
      message:"verified"
    });
    state=projectEvent(state,verifyComplete);

    expect(state.dossierReleaseSeals).toEqual([s]);
    expect(state.dossierReleaseSealVerifications).toEqual([verified]);

    const replayed=replayEvents(
      baseState(),
      [sealRequest,sealComplete,verifyRequest,verifyComplete]
    );
    expect(replayed.dossierReleaseSeals).toEqual([s]);
    expect(replayed.dossierReleaseSealVerifications).toEqual([verified]);
  });

  it("rejects seal completion without a matching operator request",()=>{
    const state=baseState();
    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:seal(),
      message:"sealed"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects malformed release seal metadata",()=>{
    let state=baseState();
    const request=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal release"
    });
    state=projectEvent(state,request);
    const malformed={...seal(),clock:"trusted-clock" as never};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:malformed,
      message:"sealed"
    })).toThrow(/metadata is invalid/i);
  });

  it("rejects the same signer key sealing one release twice",()=>{
    let state=baseState();
    const firstRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal release"
    });
    state=projectEvent(state,firstRequest);

    const first=seal();
    const firstComplete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:first,
      message:"sealed"
    });
    state=projectEvent(state,firstComplete);

    const secondRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal again"
    });
    state=projectEvent(state,secondRequest);

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:seal(),
      message:"sealed again"
    })).toThrow(/already sealed the release manifest/i);
  });

  it("rejects forged release verification linkage",()=>{
    let state=baseState();
    const sealRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal"
    });
    state=projectEvent(state,sealRequest);
    const s=seal();
    const sealComplete=buildEvent(state,{
      source:"tool",
      kind:"dossier.release.seal.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSeal:s,
      message:"sealed"
    });
    state=projectEvent(state,sealComplete);

    const verifyRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.release.verify.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:s.id,
      message:"verify"
    });
    state=projectEvent(state,verifyRequest);
    const forged={...verification(s),manifestSha256:"0".repeat(64)};

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"dossier.release.verify.completed",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      dossierReleaseSealId:s.id,
      dossierReleaseVerification:forged,
      message:"verified"
    })).toThrow(/does not match its seal/i);
  });

  it("locks release sealing during active governed execution",()=>{
    const state={...baseState(),phase:"independent" as const};
    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"dossier.release.seal.requested",
      phase:state.phase,
      dossierReleaseId:manifest.id,
      message:"seal"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
