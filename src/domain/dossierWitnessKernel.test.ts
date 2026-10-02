import {describe,expect,it} from "vitest";
import {projectEvent} from "./reducer";
import {createInitialState} from "./state";
import type {
  DossierSealReceipt,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt,
  DossierTransparencyWitnessReceipt,
  ThinkTankState
} from "./types";
import {buildEvent,buildEventBatch,replayEvents} from "../kernel/eventKernel";
import {scenarioEventInputs} from "../sim/demo";

const fakeSeal=(dossierId:string,fingerprint="a".repeat(64)):DossierSealReceipt=>({
  id:"SEAL-"+dossierId+"-"+fingerprint.slice(0,12),
  dossierId,
  tool:"ed25519-dossier-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  digestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:fingerprint,
  signatureBase64:"AQIDBAUGBwgJCgsMDQ4PEA==",
  signedAt:"2026-10-01T22:00:00.000Z",
  signerLabel:"test-signer",
  trust:"self-attested-local-key"
});

const fakeTransparency=(seal:DossierSealReceipt):DossierTransparencyReceipt=>({
  id:"TLOG-000001-"+"c".repeat(12),
  dossierId:seal.dossierId,
  sealId:seal.id,
  tool:"sha256-dossier-transparency-journal",
  canonicalization:"json-stable-v1",
  sequence:1,
  previousEntrySha256:"0".repeat(64),
  entrySha256:"c".repeat(64),
  dossierSha256:seal.digestSha256,
  publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
  loggedAt:"2026-10-01T22:02:00.000Z",
  clock:"untrusted-local-clock",
  trust:"tamper-evident-local-journal",
  journalVerifiedAtAppend:true
});

const fakeCheckpoint=(entry:DossierTransparencyReceipt):DossierTransparencyCheckpoint=>{
  const digest="d".repeat(64);
  return {
    id:"CHK-"+String(entry.sequence).padStart(6,"0")+"-"+digest.slice(0,12),
    tool:"sha256-transparency-checkpoint",
    canonicalization:"json-stable-v1",
    entryCount:entry.sequence,
    headEntryId:entry.id,
    headSha256:entry.entrySha256,
    checkpointSha256:digest,
    createdAt:"2026-10-01T22:03:00.000Z",
    clock:"untrusted-local-clock",
    trust:"portable-local-checkpoint"
  };
};

const fakeWitness=(checkpoint:DossierTransparencyCheckpoint,fingerprint="e".repeat(64)):DossierTransparencyWitnessReceipt=>({
  id:"WIT-"+checkpoint.id+"-"+fingerprint.slice(0,12),
  checkpointId:checkpoint.id,
  tool:"ed25519-transparency-witness",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  checkpointSha256:checkpoint.checkpointSha256,
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nWITNESS\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:fingerprint,
  signatureBase64:"AQIDBAUGBwgJCgsMDQ4PEA==",
  witnessedAt:"2026-10-01T22:04:00.000Z",
  witnessLabel:"independent-test",
  trust:"self-attested-external-witness-key"
});

const withTransparency=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Witness test.","council","council-gate-block",initial)
  );
  let state=events.reduce(projectEvent,initial);
  const dossier=state.decisionDossiers[0]!;
  const seal=fakeSeal(dossier.id);

  const sealRequest=buildEvent(state,{
    source:"operator",kind:"dossier.seal.requested",phase:state.phase,
    decisionDossierId:dossier.id,message:"seal"
  });
  state=projectEvent(state,sealRequest);
  const sealComplete=buildEvent(state,{
    source:"tool",kind:"dossier.seal.completed",phase:state.phase,
    decisionDossierId:dossier.id,dossierSeal:seal,message:"sealed"
  });
  state=projectEvent(state,sealComplete);

  const logRequest=buildEvent(state,{
    source:"operator",kind:"dossier.transparency.requested",phase:state.phase,
    decisionDossierId:dossier.id,dossierSealId:seal.id,message:"log"
  });
  state=projectEvent(state,logRequest);
  const entry=fakeTransparency(seal);
  const logComplete=buildEvent(state,{
    source:"tool",kind:"dossier.transparency.completed",phase:state.phase,
    decisionDossierId:dossier.id,dossierSealId:seal.id,
    dossierTransparency:entry,dossierTransparencyId:entry.id,message:"logged"
  });
  state=projectEvent(state,logComplete);

  return {
    initial,events,state,dossier,seal,entry,
    setupEvents:[sealRequest,sealComplete,logRequest,logComplete]
  };
};

const withCheckpoint=()=>{
  const base=withTransparency();
  const request=buildEvent(base.state,{
    source:"operator",kind:"dossier.checkpoint.requested",phase:base.state.phase,
    dossierTransparencyId:base.entry.id,message:"checkpoint"
  });
  const requested=projectEvent(base.state,request);
  const checkpoint=fakeCheckpoint(base.entry);
  const complete=buildEvent(requested,{
    source:"tool",kind:"dossier.checkpoint.completed",phase:requested.phase,
    dossierTransparencyId:base.entry.id,dossierCheckpoint:checkpoint,
    dossierCheckpointId:checkpoint.id,message:"checkpointed"
  });
  const state=projectEvent(requested,complete);
  return {...base,state,checkpoint,checkpointEvents:[request,complete]};
};

describe("transparency checkpoint and detached witness kernel",()=>{
  it("accepts and exactly replays a checkpoint of the latest journal head",()=>{
    const base=withCheckpoint();
    expect(base.state.dossierTransparencyCheckpoints).toEqual([base.checkpoint]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.setupEvents,...base.checkpointEvents]
    );
    expect(replayed.dossierTransparencyCheckpoints).toEqual([base.checkpoint]);
  });

  it("rejects a checkpoint that does not bind the accepted journal head",()=>{
    const base=withTransparency();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.checkpoint.requested",phase:base.state.phase,
      dossierTransparencyId:base.entry.id,message:"checkpoint"
    });
    const requested=projectEvent(base.state,request);
    const forged={...fakeCheckpoint(base.entry),headSha256:"f".repeat(64)};

    expect(()=>buildEvent(requested,{
      source:"tool",kind:"dossier.checkpoint.completed",phase:requested.phase,
      dossierTransparencyId:base.entry.id,dossierCheckpoint:forged,
      dossierCheckpointId:forged.id,message:"forged"
    })).toThrow(/does not match the accepted journal head/i);
  });

  it("accepts a matching verified detached witness receipt and replays it",()=>{
    const base=withCheckpoint();
    const witness=fakeWitness(base.checkpoint);
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.witness.requested",phase:base.state.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,message:"verify"
    });
    const requested=projectEvent(base.state,request);
    const verification={
      id:"WVER-"+witness.id,
      checkpointId:base.checkpoint.id,
      witnessId:witness.id,
      tool:"ed25519-transparency-witness-verifier" as const,
      algorithm:"Ed25519" as const,
      checkpointSha256:base.checkpoint.checkpointSha256,
      publicKeyFingerprintSha256:witness.publicKeyFingerprintSha256,
      verified:true as const,
      verifiedAt:"2026-10-01T22:05:00.000Z"
    };
    const complete=buildEvent(requested,{
      source:"tool",kind:"dossier.witness.completed",phase:requested.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,
      dossierWitnessVerification:verification,message:"verified"
    });
    const final=projectEvent(requested,complete);

    expect(final.dossierTransparencyWitnesses).toEqual([witness]);
    expect(final.dossierTransparencyWitnessVerifications).toEqual([verification]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.setupEvents,...base.checkpointEvents,request,complete]
    );
    expect(replayed.dossierTransparencyWitnesses).toEqual([witness]);
  });

  it("rejects witness completion without a matching operator submission",()=>{
    const base=withCheckpoint();
    const witness=fakeWitness(base.checkpoint);

    expect(()=>buildEvent(base.state,{
      source:"tool",kind:"dossier.witness.completed",phase:base.state.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,
      dossierWitnessVerification:{
        id:"WVER-"+witness.id,
        checkpointId:base.checkpoint.id,
        witnessId:witness.id,
        tool:"ed25519-transparency-witness-verifier",
        algorithm:"Ed25519",
        checkpointSha256:base.checkpoint.checkpointSha256,
        publicKeyFingerprintSha256:witness.publicKeyFingerprintSha256,
        verified:true,
        verifiedAt:"2026-10-01T22:05:00.000Z"
      },
      message:"verified"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects a second accepted witness from the same key for one checkpoint",()=>{
    const base=withCheckpoint();
    const witness=fakeWitness(base.checkpoint);
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.witness.requested",phase:base.state.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,message:"verify"
    });
    let state=projectEvent(base.state,request);
    const complete=buildEvent(state,{
      source:"tool",kind:"dossier.witness.completed",phase:state.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,
      dossierWitnessVerification:{
        id:"WVER-"+witness.id,
        checkpointId:base.checkpoint.id,
        witnessId:witness.id,
        tool:"ed25519-transparency-witness-verifier",
        algorithm:"Ed25519",
        checkpointSha256:base.checkpoint.checkpointSha256,
        publicKeyFingerprintSha256:witness.publicKeyFingerprintSha256,
        verified:true,
        verifiedAt:"2026-10-01T22:05:00.000Z"
      },
      message:"verified"
    });
    state=projectEvent(state,complete);

    expect(()=>buildEvent(state,{
      source:"operator",kind:"dossier.witness.requested",phase:state.phase,
      dossierCheckpointId:base.checkpoint.id,dossierWitness:witness,message:"again"
    })).toThrow(/already accepted/i);
  });

  it("locks checkpoint operations during active governed execution",()=>{
    const base=withTransparency();
    const active={...base.state,phase:"independent" as const};
    expect(()=>buildEvent(active,{
      source:"operator",kind:"dossier.checkpoint.requested",phase:active.phase,
      dossierTransparencyId:base.entry.id,message:"checkpoint"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
