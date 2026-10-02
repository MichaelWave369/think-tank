import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import {buildEventBatch} from "../kernel/eventKernel";
import {scenarioEventInputs} from "../sim/demo";
import type {
  DossierCheckpointPublicationReceipt,
  DossierRfc3161TimestampReceipt,
  DossierSealReceipt,
  DossierSealVerificationReceipt,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt,
  DossierTransparencyWitnessReceipt,
  DossierTransparencyWitnessVerificationReceipt,
  ThinkTankState
} from "./types";
import {
  evaluateProvenanceAssurance,
  provenanceAssuranceIsFresh
} from "./provenanceAssurance";

const baseState=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Assurance evaluator test.","council","council-gate-block",initial)
  );
  return events.reduce(projectEvent,initial);
};

const addCompleteChain=(state:ThinkTankState)=>{
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
    signatureBase64:"AQID",
    signedAt:"2026-10-02T02:00:00.000Z",
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
    verifiedAt:"2026-10-02T02:00:01.000Z"
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
    loggedAt:"2026-10-02T02:01:00.000Z",
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
    createdAt:"2026-10-02T02:02:00.000Z",
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };
  const witness:DossierTransparencyWitnessReceipt={
    id:"WIT-"+checkpoint.id+"-"+"e".repeat(12),
    checkpointId:checkpoint.id,
    tool:"ed25519-transparency-witness",
    algorithm:"Ed25519",
    canonicalization:"json-stable-v1",
    checkpointSha256:checkpoint.checkpointSha256,
    publicKeyPem:"-----BEGIN PUBLIC KEY-----\nWITNESS\n-----END PUBLIC KEY-----",
    publicKeyFingerprintSha256:"e".repeat(64),
    signatureBase64:"AQIDBA==",
    witnessedAt:"2026-10-02T02:03:00.000Z",
    witnessLabel:"external-test",
    trust:"self-attested-external-witness-key"
  };
  const witnessVerification:DossierTransparencyWitnessVerificationReceipt={
    id:"WVER-"+witness.id,
    checkpointId:checkpoint.id,
    witnessId:witness.id,
    tool:"ed25519-transparency-witness-verifier",
    algorithm:"Ed25519",
    checkpointSha256:checkpoint.checkpointSha256,
    publicKeyFingerprintSha256:witness.publicKeyFingerprintSha256,
    verified:true,
    verifiedAt:"2026-10-02T02:03:01.000Z"
  };
  const timestamp:DossierRfc3161TimestampReceipt={
    id:"TSA-"+checkpoint.id+"-"+"f".repeat(12),
    checkpointId:checkpoint.id,
    tool:"rfc3161-timestamp-verifier",
    standard:"RFC3161",
    hashAlgorithm:"SHA-256",
    checkpointSha256:checkpoint.checkpointSha256,
    tokenSha256:"f".repeat(64),
    tokenBase64:"AQIDBAUG",
    tsaPolicyOid:"1.2.3.4",
    tsaSerialNumber:"0x01",
    genTime:"2026-10-02T02:04:00.000Z",
    tsaSubject:"CN=Example TSA",
    authorityUrl:"https://tsa.example.test/",
    trustAnchorSha256:"1".repeat(64),
    verifiedAt:"2026-10-02T02:04:01.000Z",
    trust:"configured-rfc3161-trust-anchor"
  };
  const publication:DossierCheckpointPublicationReceipt={
    id:"PUB-"+checkpoint.id+"-"+"2".repeat(12),
    checkpointId:checkpoint.id,
    tool:"verified-checkpoint-publisher",
    protocol:"phi-checkpoint-publication-v1",
    checkpointSha256:checkpoint.checkpointSha256,
    publisherUrl:"https://api.example.test/publish",
    retrievalUrl:"https://public.example.test/checkpoints/"+checkpoint.id+".json",
    publicationId:"pub-1",
    publisherClaimedAt:"2026-10-02T02:05:00.000Z",
    payloadSha256:"3".repeat(64),
    retrievalHttpStatus:200,
    retrievalContentType:"application/json",
    retrievalVerifiedAt:"2026-10-02T02:05:01.000Z",
    receiptSha256:"2".repeat(64),
    trust:"externally-retrieved-publication"
  };

  return {
    ...state,
    dossierSeals:[seal],
    dossierSealVerifications:[verification],
    dossierTransparencyEntries:[entry],
    dossierTransparencyCheckpoints:[checkpoint],
    dossierTransparencyWitnesses:[witness],
    dossierTransparencyWitnessVerifications:[witnessVerification],
    dossierRfc3161Timestamps:[timestamp],
    dossierCheckpointPublications:[publication]
  };
};

describe("provenance assurance evaluator",()=>{
  it("satisfies full provenance only when one checkpoint carries every required layer",()=>{
    const state=addCompleteChain(baseState());
    const dossier=state.decisionDossiers[0]!;
    const report=evaluateProvenanceAssurance(state,dossier.id,"full-provenance");

    expect(report.passed).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.checkpointId).toBe(state.dossierTransparencyCheckpoints[0]!.id);
    expect(report.requirements.every(item=>item.satisfied)).toBe(true);
    expect(report.truthAuthority).toBe(false);
  });

  it("reports only the missing policy-specific requirements",()=>{
    const complete=addCompleteChain(baseState());
    const state={
      ...complete,
      dossierTransparencyWitnesses:[],
      dossierTransparencyWitnessVerifications:[],
      dossierRfc3161Timestamps:[],
      dossierCheckpointPublications:[]
    };
    const dossier=state.decisionDossiers[0]!;

    expect(evaluateProvenanceAssurance(state,dossier.id,"integrity").passed).toBe(true);
    expect(evaluateProvenanceAssurance(state,dossier.id,"witnessed").missing)
      .toEqual(["verified-witness"]);
    expect(evaluateProvenanceAssurance(state,dossier.id,"time-attested").missing)
      .toEqual(["rfc3161-time"]);
    expect(evaluateProvenanceAssurance(state,dossier.id,"published").missing)
      .toEqual(["verified-publication"]);
  });

  it("does not combine external layers from different checkpoints into one full-provenance pass",()=>{
    const state=addCompleteChain(baseState());
    const first=state.dossierTransparencyCheckpoints[0]!;
    const second:DossierTransparencyCheckpoint={
      ...first,
      id:"CHK-000001-"+"9".repeat(12),
      checkpointSha256:"9".repeat(64)
    };
    const movedTimestamp={
      ...state.dossierRfc3161Timestamps[0]!,
      id:"TSA-"+second.id+"-"+"8".repeat(12),
      checkpointId:second.id,
      checkpointSha256:second.checkpointSha256,
      tokenSha256:"8".repeat(64)
    };
    const split={
      ...state,
      dossierTransparencyCheckpoints:[first,second],
      dossierRfc3161Timestamps:[movedTimestamp]
    };
    const dossier=split.decisionDossiers[0]!;
    const report=evaluateProvenanceAssurance(split,dossier.id,"full-provenance");

    expect(report.passed).toBe(false);
    expect(report.missing.length).toBeGreaterThan(0);
  });

  it("marks a report stale when linked provenance changes",()=>{
    const state=addCompleteChain(baseState());
    const dossier=state.decisionDossiers[0]!;
    const report=evaluateProvenanceAssurance(state,dossier.id,"integrity");

    expect(provenanceAssuranceIsFresh(state,report)).toBe(true);

    const changed={
      ...state,
      dossierCheckpointPublications:[
        ...state.dossierCheckpointPublications,
        {...state.dossierCheckpointPublications[0]!,id:"PUB-extra",publicationId:"pub-extra"}
      ]
    };
    expect(provenanceAssuranceIsFresh(changed,report)).toBe(false);
  });
});
