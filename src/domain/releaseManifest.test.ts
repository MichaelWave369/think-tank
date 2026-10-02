import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import type {
  DossierProvenanceAssuranceReport,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt,
  DossierSealReceipt,
  DossierSealVerificationReceipt,
  ThinkTankState
} from "./types";
import {
  buildDossierReleaseManifest,
  releaseArtifactIds,
  releaseEligibleAssurance,
  releaseManifestIsCurrent
} from "./releaseManifest";

const stateWithIntegrityAssurance=()=>{
  const base=createInitialState();
  const dossier={
    id:"DOS-0001",
    sessionId:base.sessionId,
    seed:base.seed,
    decisionSeq:1,
    mode:base.mode,
    executionSource:"governed-system" as const,
    operatorPrompt:"Release test",
    outcome:"completed" as const,
    outputLabel:"STANDARD" as const,
    actionAllowed:true,
    gateScore:.9,
    gateThreshold:.75,
    gateBreakdown:null,
    claimGovernance:{
      mode:base.mode,policy:"informational" as const,applicableClaimIds:[],freshClaimIds:[],
      missingReviewClaimIds:[],staleReviewClaimIds:[],coverageBlockedClaimIds:[],
      passed:true,reason:"test"
    },
    argumentGovernance:{
      mode:base.mode,policy:"informational" as const,applicableClaimIds:[],freshAcceptedClaimIds:[],
      missingAcceptedClaimIds:[],staleAcceptedClaimIds:[],draftOnlyClaimIds:[],
      passed:true,reason:"test"
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
    signedAt:"2026-10-02T04:00:00.000Z",
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
    verifiedAt:"2026-10-02T04:00:01.000Z"
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
    loggedAt:"2026-10-02T04:01:00.000Z",
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
    createdAt:"2026-10-02T04:02:00.000Z",
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };

  const state:ThinkTankState={
    ...base,
    decisionDossiers:[dossier],
    dossierSeals:[seal],
    dossierSealVerifications:[verification],
    dossierTransparencyEntries:[entry],
    dossierTransparencyCheckpoints:[checkpoint]
  };

  const basisFingerprint="fnv1a32:00000000";
  const report:DossierProvenanceAssuranceReport={
    id:"ASSURE-"+dossier.id+"-integrity-00000000",
    dossierId:dossier.id,
    policy:"integrity",
    basisFingerprint,
    checkpointId:checkpoint.id,
    journalHeadStatus:"current",
    requirements:[
      {requirement:"verified-seal",satisfied:true,evidenceIds:[seal.id,verification.id]},
      {requirement:"journal-entry",satisfied:true,evidenceIds:[entry.id]},
      {requirement:"checkpoint",satisfied:true,evidenceIds:[checkpoint.id]}
    ],
    missing:[],
    passed:true,
    reason:"Policy requirements are satisfied by one linked provenance chain.",
    truthAuthority:false
  };

  return {state,dossier,seal,verification,entry,checkpoint,report};
};

describe("assurance-gated release manifest",()=>{
  it("builds a deterministic manifest from a fresh passing assurance report",async()=>{
    const fixture=stateWithIntegrityAssurance();
    const assurance=await import("./provenanceAssurance");
    const real=assurance.evaluateProvenanceAssurance(
      fixture.state,
      fixture.dossier.id,
      "integrity"
    );
    const state={...fixture.state,dossierProvenanceAssurances:[real]};

    const manifest=buildDossierReleaseManifest(
      state,
      fixture.dossier.id,
      "integrity",
      real.id
    );

    expect(manifest.dossierId).toBe(fixture.dossier.id);
    expect(manifest.policy).toBe("integrity");
    expect(manifest.assuranceReportId).toBe(real.id);
    expect(manifest.checkpointId).toBe(fixture.checkpoint.id);
    expect(manifest.releaseAuthority).toBe("fresh-passing-provenance-policy");
    expect(manifest.truthAuthority).toBe(false);
    expect(manifest.id).toContain("REL-"+fixture.dossier.id+"-integrity-");
    expect(releaseManifestIsCurrent(state,manifest)).toBe(true);
  });

  it("includes only sorted unique artifacts named by the assurance chain plus dossier/override",async()=>{
    const fixture=stateWithIntegrityAssurance();
    const assurance=await import("./provenanceAssurance");
    const real=assurance.evaluateProvenanceAssurance(
      fixture.state,
      fixture.dossier.id,
      "integrity"
    );
    const state={...fixture.state,dossierProvenanceAssurances:[real]};
    const ids=releaseArtifactIds(state,real);

    expect(ids).toEqual([...ids].sort((a,b)=>a.localeCompare(b)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(fixture.dossier.id);
    expect(ids).toContain(real.id);
    expect(ids).toContain(fixture.checkpoint.id);
  });

  it("rejects failed assurance",async()=>{
    const fixture=stateWithIntegrityAssurance();
    const assurance=await import("./provenanceAssurance");
    const real=assurance.evaluateProvenanceAssurance(
      fixture.state,
      fixture.dossier.id,
      "full-provenance"
    );
    const state={...fixture.state,dossierProvenanceAssurances:[real]};

    expect(real.passed).toBe(false);
    expect(releaseEligibleAssurance(state,fixture.dossier.id,"full-provenance",real.id)).toBeNull();
    expect(()=>buildDossierReleaseManifest(
      state,fixture.dossier.id,"full-provenance",real.id
    )).toThrow(/fresh passing provenance assurance/i);
  });

  it("rejects stale assurance after linked provenance changes",async()=>{
    const fixture=stateWithIntegrityAssurance();
    const assurance=await import("./provenanceAssurance");
    const real=assurance.evaluateProvenanceAssurance(
      fixture.state,
      fixture.dossier.id,
      "integrity"
    );
    const state={...fixture.state,dossierProvenanceAssurances:[real]};
    const manifest=buildDossierReleaseManifest(state,fixture.dossier.id,"integrity",real.id);

    const changed:ThinkTankState={
      ...state,
      dossierCheckpointPublications:[{
        id:"PUB-"+fixture.checkpoint.id+"-"+"e".repeat(12),
        checkpointId:fixture.checkpoint.id,
        tool:"verified-checkpoint-publisher",
        protocol:"phi-checkpoint-publication-v1",
        checkpointSha256:fixture.checkpoint.checkpointSha256,
        publisherUrl:"https://api.example.test/publish",
        retrievalUrl:"https://public.example.test/checkpoint.json",
        publicationId:"pub-1",
        publisherClaimedAt:"2026-10-02T04:03:00.000Z",
        payloadSha256:"f".repeat(64),
        retrievalHttpStatus:200,
        retrievalContentType:"application/json",
        retrievalVerifiedAt:"2026-10-02T04:03:01.000Z",
        receiptSha256:"e".repeat(64),
        trust:"externally-retrieved-publication"
      }]
    };

    expect(releaseEligibleAssurance(changed,fixture.dossier.id,"integrity",real.id)).toBeNull();
    expect(releaseManifestIsCurrent(changed,manifest)).toBe(false);
  });
});
