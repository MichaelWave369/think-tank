import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import type {DossierReleaseManifest,DossierReleaseSealReceipt,DossierReleaseSealVerificationReceipt,ThinkTankState} from "./types";
import {
  buildDossierReleasePackage,
  releasePackageBasisFingerprint,
  releasePackageHasVerifiedSeal
} from "./releasePackage";

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

const seal=(idSuffix:string):DossierReleaseSealReceipt=>({
  id:"RSEAL-"+manifest.id+"-"+idSuffix,
  releaseId:manifest.id,
  dossierId:manifest.dossierId,
  tool:"ed25519-release-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  manifestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:(idSuffix+"0".repeat(64)).slice(0,64),
  signatureBase64:"AQID",
  signedAt:"2026-10-02T07:00:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"test",
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
  verifiedAt:"2026-10-02T07:00:01.000Z"
});

describe("governed release package",()=>{
  it("sorts attestation layers deterministically",()=>{
    const a=seal("aaaaaaaaaaaa");
    const b=seal("bbbbbbbbbbbb");
    const state:ThinkTankState={
      ...createInitialState(),
      dossierReleaseManifests:[manifest],
      dossierReleaseSeals:[b,a],
      dossierReleaseSealVerifications:[verification(b),verification(a)]
    };
    const pkg=buildDossierReleasePackage(state,manifest.id);
    expect(pkg.releaseSeals.map(item=>item.id)).toEqual([a.id,b.id]);
    expect(pkg.releaseSealVerifications.map(item=>item.id)).toEqual(
      [verification(a).id,verification(b).id]
    );
  });

  it("requires a successful RVER for publication eligibility",()=>{
    const s=seal("aaaaaaaaaaaa");
    const base:ThinkTankState={
      ...createInitialState(),
      dossierReleaseManifests:[manifest],
      dossierReleaseSeals:[s]
    };
    expect(releasePackageHasVerifiedSeal(base,manifest.id)).toBe(false);
    expect(releasePackageHasVerifiedSeal(
      {...base,dossierReleaseSealVerifications:[verification(s)]},
      manifest.id
    )).toBe(true);
  });

  it("changes basis fingerprint when release attestation state changes",()=>{
    const s=seal("aaaaaaaaaaaa");
    const state:ThinkTankState={
      ...createInitialState(),
      dossierReleaseManifests:[manifest],
      dossierReleaseSeals:[s],
      dossierReleaseSealVerifications:[verification(s)]
    };
    const before=releasePackageBasisFingerprint(state,manifest.id);
    const after=releasePackageBasisFingerprint({
      ...state,
      dossierReleaseRfc3161Timestamps:[{
        id:"RTSA-"+s.id+"-"+"c".repeat(12),
        releaseId:manifest.id,
        sealId:s.id,
        tool:"rfc3161-release-seal-timestamp-verifier",
        standard:"RFC3161",
        hashAlgorithm:"SHA-256",
        releaseSealSha256:"d".repeat(64),
        manifestSha256:s.manifestSha256,
        publicKeyFingerprintSha256:s.publicKeyFingerprintSha256,
        tokenSha256:"c".repeat(64),
        tokenBase64:"AQID",
        tsaPolicyOid:"1.2.3",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-02T07:01:00.000Z",
        tsaSubject:"CN=TSA",
        authorityUrl:"https://tsa.example.test/",
        trustAnchorSha256:"e".repeat(64),
        verifiedAt:"2026-10-02T07:01:01.000Z",
        trust:"configured-rfc3161-trust-anchor"
      }]
    },manifest.id);
    expect(after).not.toBe(before);
  });
});
