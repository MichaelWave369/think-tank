import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import type {
  DossierReleaseManifest,
  DossierReleasePublicationAuditReceipt,
  DossierReleasePublicationReceipt,
  DossierReleaseSealReceipt,
  DossierReleaseSealVerificationReceipt,
  ThinkTankState
} from "./types";
import {releasePackageBasisFingerprint} from "./releasePackage";
import {
  evaluateReleaseAvailabilityAssurance,
  releaseAvailabilityAssuranceIsFresh
} from "./releaseAvailabilityAssurance";

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
  signedAt:"2026-10-02T10:00:00.000Z",
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
  verifiedAt:"2026-10-02T10:00:01.000Z"
};

const packageSha="c".repeat(64);

const base=():ThinkTankState=>({
  ...createInitialState(),
  phase:"complete",
  dossierReleaseManifests:[manifest],
  dossierReleaseSeals:[seal],
  dossierReleaseSealVerifications:[verification]
});

const publication=(
  state:ThinkTankState,
  suffix:string,
  retrievalUrl:string
):DossierReleasePublicationReceipt=>{
  const fingerprint=releasePackageBasisFingerprint(state,manifest.id);
  const receiptSha256=(suffix.repeat(64)).slice(0,64);
  return {
    id:"RPUB-"+manifest.id+"-"+receiptSha256.slice(0,12),
    releaseId:manifest.id,
    tool:"verified-release-package-publisher",
    protocol:"phi-release-publication-v1",
    packageBasisFingerprint:fingerprint,
    manifestSha256:seal.manifestSha256,
    packageSha256:packageSha,
    publisherUrl:"https://publisher-"+suffix+".example.test/publish",
    retrievalUrl,
    publicationId:"pub-"+suffix,
    publisherClaimedAt:"2026-10-02T10:01:00.000Z",
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T10:01:01.000Z",
    releaseSealIds:[seal.id],
    releaseVerificationIds:[verification.id],
    releaseTimestampIds:[],
    artifactIds:[],
    receiptSha256,
    trust:"externally-retrieved-release-publication"
  };
};

const audit=(
  pub:DossierReleasePublicationReceipt,
  suffix:string
):DossierReleasePublicationAuditReceipt=>{
  const receiptSha256=(suffix.repeat(64)).slice(0,64);
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
    checkedAt:"2026-10-02T1"+suffix.length+":00:00.000Z",
    clock:"untrusted-local-clock",
    readbackSha256:pub.packageSha256,
    exactMatch:true,
    receiptSha256,
    trust:"repeat-external-retrieval"
  };
};

describe("release availability assurance",()=>{
  it("separates published, rechecked, and repeated profiles",()=>{
    const state0=base();
    const pub=publication(state0,"1","https://a.example.test/releases/pkg.json");
    const published={...state0,dossierReleasePublications:[pub]};

    expect(evaluateReleaseAvailabilityAssurance(
      published,manifest.id,packageSha,"published"
    ).passed).toBe(true);
    expect(evaluateReleaseAvailabilityAssurance(
      published,manifest.id,packageSha,"rechecked"
    ).passed).toBe(false);

    const oneAudit={...published,dossierReleasePublicationAudits:[audit(pub,"2")]};
    expect(evaluateReleaseAvailabilityAssurance(
      oneAudit,manifest.id,packageSha,"rechecked"
    ).passed).toBe(true);
    expect(evaluateReleaseAvailabilityAssurance(
      oneAudit,manifest.id,packageSha,"repeated"
    ).passed).toBe(false);

    const twoAudits={
      ...oneAudit,
      dossierReleasePublicationAudits:[audit(pub,"2"),audit(pub,"3")]
    };
    expect(evaluateReleaseAvailabilityAssurance(
      twoAudits,manifest.id,packageSha,"repeated"
    ).passed).toBe(true);
  });

  it("requires distinct HTTPS origins for multi-origin assurance",()=>{
    const state0=base();
    const a=publication(state0,"1","https://same.example.test/a/pkg.json");
    const b=publication(state0,"2","https://same.example.test/b/pkg.json");
    const sameOrigin={
      ...state0,
      dossierReleasePublications:[a,b],
      dossierReleasePublicationAudits:[audit(a,"3"),audit(b,"4")]
    };

    const report=evaluateReleaseAvailabilityAssurance(
      sameOrigin,manifest.id,packageSha,"multi-origin"
    );
    expect(report.passed).toBe(false);
    expect(report.retrievalOrigins).toEqual(["https://same.example.test"]);
    expect(report.missing).toContain("multiple-retrieval-origins");
  });

  it("passes multi-origin only when each distinct origin was rechecked",()=>{
    const state0=base();
    const a=publication(state0,"1","https://a.example.test/pkg.json");
    const b=publication(state0,"2","https://b.example.test/pkg.json");
    const onlyA={
      ...state0,
      dossierReleasePublications:[a,b],
      dossierReleasePublicationAudits:[audit(a,"3")]
    };

    expect(evaluateReleaseAvailabilityAssurance(
      onlyA,manifest.id,packageSha,"multi-origin"
    ).passed).toBe(false);

    const both={
      ...onlyA,
      dossierReleasePublicationAudits:[audit(a,"3"),audit(b,"4")]
    };
    const report=evaluateReleaseAvailabilityAssurance(
      both,manifest.id,packageSha,"multi-origin"
    );
    expect(report.passed).toBe(true);
    expect(report.retrievalOrigins).toEqual([
      "https://a.example.test",
      "https://b.example.test"
    ]);
    expect(report.originIndependenceAuthority).toBe(false);
  });

  it("does not let an extra unaudited origin invalidate two qualifying origins",()=>{
    const state0=base();
    const a=publication(state0,"1","https://a.example.test/pkg.json");
    const b=publication(state0,"2","https://b.example.test/pkg.json");
    const cPub=publication(state0,"7","https://c.example.test/pkg.json");
    const state={
      ...state0,
      dossierReleasePublications:[a,b,cPub],
      dossierReleasePublicationAudits:[
        audit(a,"3"),
        audit(b,"4")
      ]
    };

    expect(evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"multi-origin"
    ).passed).toBe(true);
  });

  it("requires two repeat observations on each origin for resilient assurance",()=>{
    const state0=base();
    const a=publication(state0,"1","https://a.example.test/pkg.json");
    const b=publication(state0,"2","https://b.example.test/pkg.json");
    const almost={
      ...state0,
      dossierReleasePublications:[a,b],
      dossierReleasePublicationAudits:[
        audit(a,"3"),
        audit(a,"4"),
        audit(b,"5")
      ]
    };

    expect(evaluateReleaseAvailabilityAssurance(
      almost,manifest.id,packageSha,"resilient"
    ).passed).toBe(false);

    const enough={
      ...almost,
      dossierReleasePublicationAudits:[
        audit(a,"3"),
        audit(a,"4"),
        audit(b,"5"),
        audit(b,"6")
      ]
    };
    const report=evaluateReleaseAvailabilityAssurance(
      enough,manifest.id,packageSha,"resilient"
    );
    expect(report.passed).toBe(true);
    expect(report.continuousAvailability).toBe(false);
    expect(report.immutabilityAuthority).toBe(false);
    expect(report.truthAuthority).toBe(false);
  });

  it("marks report stale when matching package evidence changes",()=>{
    const state0=base();
    const pub=publication(state0,"1","https://a.example.test/pkg.json");
    const state={
      ...state0,
      dossierReleasePublications:[pub],
      dossierReleasePublicationAudits:[audit(pub,"2")]
    };
    const report=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    expect(releaseAvailabilityAssuranceIsFresh(state,report)).toBe(true);

    const changed={
      ...state,
      dossierReleasePublicationAudits:[
        ...state.dossierReleasePublicationAudits,
        audit(pub,"3")
      ]
    };
    expect(releaseAvailabilityAssuranceIsFresh(changed,report)).toBe(false);
  });

  it("does not stale report for unrelated package evidence",()=>{
    const state0=base();
    const pub=publication(state0,"1","https://a.example.test/pkg.json");
    const state={
      ...state0,
      dossierReleasePublications:[pub],
      dossierReleasePublicationAudits:[audit(pub,"2")]
    };
    const report=evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"rechecked"
    );
    const unrelated:DossierReleasePublicationReceipt={
      ...pub,
      id:"RPUB-OTHER-"+"9".repeat(12),
      packageSha256:"9".repeat(64),
      packageBasisFingerprint:"fnv1a32:99999999",
      publicationId:"other",
      retrievalUrl:"https://other.example.test/pkg.json",
      receiptSha256:"9".repeat(64)
    };
    const changed={
      ...state,
      dossierReleasePublications:[...state.dossierReleasePublications,unrelated]
    };
    expect(releaseAvailabilityAssuranceIsFresh(changed,report)).toBe(true);
  });

  it("rejects contradictory package-basis metadata for one package SHA",()=>{
    const state0=base();
    const a=publication(state0,"1","https://a.example.test/pkg.json");
    const b={
      ...publication(state0,"2","https://b.example.test/pkg.json"),
      packageBasisFingerprint:"fnv1a32:ffffffff"
    };
    const state={...state0,dossierReleasePublications:[a,b]};

    expect(()=>evaluateReleaseAvailabilityAssurance(
      state,manifest.id,packageSha,"multi-origin"
    )).toThrow(/disagree on package-basis fingerprint/i);
  });
});
