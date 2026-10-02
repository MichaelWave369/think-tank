import {describe,expect,it} from "vitest";
import {projectEvent} from "./reducer";
import {createInitialState} from "./state";
import type {
  DossierSealReceipt,
  DossierSealVerificationReceipt,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt
} from "./types";
import {evaluateProvenanceAssurance} from "./provenanceAssurance";
import {buildEvent,buildEventBatch,replayEvents} from "../kernel/eventKernel";
import {scenarioEventInputs} from "../sim/demo";

const withIntegrityChain=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Assurance kernel test.","council","council-gate-block",initial)
  );
  let state=events.reduce(projectEvent,initial);
  const dossier=state.decisionDossiers[0]!;

  const seal:DossierSealReceipt={
    id:"SEAL-"+dossier.id+"-"+"a".repeat(12),
    dossierId:dossier.id,
    tool:"ed25519-dossier-sealer",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    digestSha256:"b".repeat(64),
    publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    publicKeyFingerprintSha256:"a".repeat(64),
    signatureBase64:"AQIDBAUG",
    signedAt:"2026-10-02T03:00:00.000Z",
    signerLabel:"test",
    trust:"self-attested-local-key"
  };

  const sealRequest=buildEvent(state,{
    source:"operator",
    kind:"dossier.seal.requested",
    phase:state.phase,
    decisionDossierId:dossier.id,
    message:"seal"
  });
  state=projectEvent(state,sealRequest);

  const sealComplete=buildEvent(state,{
    source:"tool",
    kind:"dossier.seal.completed",
    phase:state.phase,
    decisionDossierId:dossier.id,
    dossierSeal:seal,
    message:"sealed"
  });
  state=projectEvent(state,sealComplete);

  const verifyRequest=buildEvent(state,{
    source:"operator",
    kind:"dossier.verify.requested",
    phase:state.phase,
    dossierSealId:seal.id,
    message:"verify"
  });
  state=projectEvent(state,verifyRequest);

  const verification:DossierSealVerificationReceipt={
    id:"DVER-"+seal.id,
    dossierId:dossier.id,
    sealId:seal.id,
    tool:"ed25519-dossier-verifier",
    algorithm:"Ed25519",
    digestSha256:seal.digestSha256,
    publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
    verified:true,
    verifiedAt:"2026-10-02T03:00:01.000Z"
  };

  const verifyComplete=buildEvent(state,{
    source:"tool",
    kind:"dossier.verify.completed",
    phase:state.phase,
    dossierSealId:seal.id,
    dossierVerification:verification,
    message:"verified"
  });
  state=projectEvent(state,verifyComplete);

  const transparencyRequest=buildEvent(state,{
    source:"operator",
    kind:"dossier.transparency.requested",
    phase:state.phase,
    decisionDossierId:dossier.id,
    dossierSealId:seal.id,
    message:"log"
  });
  state=projectEvent(state,transparencyRequest);

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
    loggedAt:"2026-10-02T03:01:00.000Z",
    clock:"untrusted-local-clock",
    trust:"tamper-evident-local-journal",
    journalVerifiedAtAppend:true
  };

  const transparencyComplete=buildEvent(state,{
    source:"tool",
    kind:"dossier.transparency.completed",
    phase:state.phase,
    decisionDossierId:dossier.id,
    dossierSealId:seal.id,
    dossierTransparency:entry,
    dossierTransparencyId:entry.id,
    message:"logged"
  });
  state=projectEvent(state,transparencyComplete);

  const checkpointRequest=buildEvent(state,{
    source:"operator",
    kind:"dossier.checkpoint.requested",
    phase:state.phase,
    dossierTransparencyId:entry.id,
    message:"checkpoint"
  });
  state=projectEvent(state,checkpointRequest);

  const checkpoint:DossierTransparencyCheckpoint={
    id:"CHK-000001-"+"d".repeat(12),
    tool:"sha256-transparency-checkpoint",
    canonicalization:"json-stable-v1",
    entryCount:1,
    headEntryId:entry.id,
    headSha256:entry.entrySha256,
    checkpointSha256:"d".repeat(64),
    createdAt:"2026-10-02T03:02:00.000Z",
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };

  const checkpointComplete=buildEvent(state,{
    source:"tool",
    kind:"dossier.checkpoint.completed",
    phase:state.phase,
    dossierTransparencyId:entry.id,
    dossierCheckpoint:checkpoint,
    dossierCheckpointId:checkpoint.id,
    message:"checkpointed"
  });
  state=projectEvent(state,checkpointComplete);

  return {
    initial,
    events,
    state,
    dossier,
    setupEvents:[
      sealRequest,
      sealComplete,
      verifyRequest,
      verifyComplete,
      transparencyRequest,
      transparencyComplete,
      checkpointRequest,
      checkpointComplete
    ]
  };
};

describe("provenance assurance kernel",()=>{
  it("accepts and exactly replays deterministic assurance reports",()=>{
    const base=withIntegrityChain();
    const report=evaluateProvenanceAssurance(base.state,base.dossier.id,"integrity");

    const request=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.assurance.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      message:"evaluate"
    });
    const requested=projectEvent(base.state,request);

    const complete=buildEvent(requested,{
      source:"system",
      kind:"dossier.assurance.completed",
      phase:requested.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssurance:report,
      message:"evaluated"
    });
    const final=projectEvent(requested,complete);

    expect(report.passed).toBe(true);
    expect(final.dossierProvenanceAssurances).toEqual([report]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.setupEvents,request,complete]
    );
    expect(replayed.dossierProvenanceAssurances).toEqual([report]);
  });

  it("rejects a forged assurance report",()=>{
    const base=withIntegrityChain();
    const request=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.assurance.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      message:"evaluate"
    });
    const requested=projectEvent(base.state,request);
    const report=evaluateProvenanceAssurance(requested,base.dossier.id,"integrity");
    const forged={...report,passed:false,truthAuthority:false as const};

    expect(()=>buildEvent(requested,{
      source:"system",
      kind:"dossier.assurance.completed",
      phase:requested.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssurance:forged,
      message:"forged"
    })).toThrow(/does not match deterministic recomputation/i);
  });

  it("rejects completion without a matching operator request",()=>{
    const base=withIntegrityChain();
    const report=evaluateProvenanceAssurance(base.state,base.dossier.id,"integrity");

    expect(()=>buildEvent(base.state,{
      source:"system",
      kind:"dossier.assurance.completed",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssurance:report,
      message:"evaluated"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects duplicate reports for the same dossier policy and basis",()=>{
    const base=withIntegrityChain();
    const report=evaluateProvenanceAssurance(base.state,base.dossier.id,"integrity");

    const firstRequest=buildEvent(base.state,{
      source:"operator",
      kind:"dossier.assurance.requested",
      phase:base.state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      message:"evaluate"
    });
    let state=projectEvent(base.state,firstRequest);

    const firstComplete=buildEvent(state,{
      source:"system",
      kind:"dossier.assurance.completed",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssurance:report,
      message:"evaluated"
    });
    state=projectEvent(state,firstComplete);

    const secondRequest=buildEvent(state,{
      source:"operator",
      kind:"dossier.assurance.requested",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      message:"evaluate again"
    });
    state=projectEvent(state,secondRequest);

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"dossier.assurance.completed",
      phase:state.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      provenanceAssurance:report,
      message:"duplicate"
    })).toThrow(/already has an assurance report/i);
  });

  it("locks assurance evaluation during active governed execution",()=>{
    const base=withIntegrityChain();
    const active={...base.state,phase:"independent" as const};

    expect(()=>buildEvent(active,{
      source:"operator",
      kind:"dossier.assurance.requested",
      phase:active.phase,
      decisionDossierId:base.dossier.id,
      provenancePolicy:"integrity",
      message:"evaluate"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
