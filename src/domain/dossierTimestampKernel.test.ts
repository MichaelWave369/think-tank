import {describe,expect,it} from "vitest";
import {projectEvent} from "./reducer";
import {createInitialState} from "./state";
import type {
  DossierRfc3161TimestampReceipt,
  DossierSealReceipt,
  DossierTransparencyCheckpoint,
  DossierTransparencyReceipt
} from "./types";
import {buildEvent,buildEventBatch,replayEvents} from "../kernel/eventKernel";
import {scenarioEventInputs} from "../sim/demo";

const seal=(dossierId:string):DossierSealReceipt=>({
  id:"SEAL-"+dossierId+"-"+"a".repeat(12),
  dossierId,
  tool:"ed25519-dossier-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  digestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:"a".repeat(64),
  signatureBase64:"AQIDBAUG",
  signedAt:"2026-10-01T22:00:00.000Z",
  signerLabel:"test",
  trust:"self-attested-local-key"
});

const entry=(s:DossierSealReceipt):DossierTransparencyReceipt=>({
  id:"TLOG-000001-"+"c".repeat(12),
  dossierId:s.dossierId,
  sealId:s.id,
  tool:"sha256-dossier-transparency-journal",
  canonicalization:"json-stable-v1",
  sequence:1,
  previousEntrySha256:"0".repeat(64),
  entrySha256:"c".repeat(64),
  dossierSha256:s.digestSha256,
  publicKeyFingerprintSha256:s.publicKeyFingerprintSha256,
  loggedAt:"2026-10-01T22:01:00.000Z",
  clock:"untrusted-local-clock",
  trust:"tamper-evident-local-journal",
  journalVerifiedAtAppend:true
});

const checkpoint=(e:DossierTransparencyReceipt):DossierTransparencyCheckpoint=>({
  id:"CHK-000001-"+"d".repeat(12),
  tool:"sha256-transparency-checkpoint",
  canonicalization:"json-stable-v1",
  entryCount:1,
  headEntryId:e.id,
  headSha256:e.entrySha256,
  checkpointSha256:"d".repeat(64),
  createdAt:"2026-10-01T22:02:00.000Z",
  clock:"untrusted-local-clock",
  trust:"portable-local-checkpoint"
});

const timestamp=(chk:DossierTransparencyCheckpoint,tokenSha="e".repeat(64)):DossierRfc3161TimestampReceipt=>({
  id:"TSA-"+chk.id+"-"+tokenSha.slice(0,12),
  checkpointId:chk.id,
  tool:"rfc3161-timestamp-verifier",
  standard:"RFC3161",
  hashAlgorithm:"SHA-256",
  checkpointSha256:chk.checkpointSha256,
  tokenSha256:tokenSha,
  tokenBase64:"AQIDBAUGBwgJCg==",
  tsaPolicyOid:"1.2.3.4.5",
  tsaSerialNumber:"0x01AF",
  genTime:"2026-10-01T22:03:00.000Z",
  tsaSubject:"DirName:/CN=Example TSA",
  authorityUrl:"https://tsa.example.test/",
  trustAnchorSha256:"f".repeat(64),
  verifiedAt:"2026-10-01T22:03:01.000Z",
  trust:"configured-rfc3161-trust-anchor"
});

const withCheckpoint=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Timestamp test.","council","council-gate-block",initial)
  );
  let state=events.reduce(projectEvent,initial);
  const dossier=state.decisionDossiers[0]!;
  const s=seal(dossier.id);

  const sealRequest=buildEvent(state,{
    source:"operator",kind:"dossier.seal.requested",phase:state.phase,
    decisionDossierId:dossier.id,message:"seal"
  });
  state=projectEvent(state,sealRequest);
  const sealComplete=buildEvent(state,{
    source:"tool",kind:"dossier.seal.completed",phase:state.phase,
    decisionDossierId:dossier.id,dossierSeal:s,message:"sealed"
  });
  state=projectEvent(state,sealComplete);

  const logRequest=buildEvent(state,{
    source:"operator",kind:"dossier.transparency.requested",phase:state.phase,
    decisionDossierId:dossier.id,dossierSealId:s.id,message:"log"
  });
  state=projectEvent(state,logRequest);
  const e=entry(s);
  const logComplete=buildEvent(state,{
    source:"tool",kind:"dossier.transparency.completed",phase:state.phase,
    decisionDossierId:dossier.id,dossierSealId:s.id,
    dossierTransparency:e,dossierTransparencyId:e.id,message:"logged"
  });
  state=projectEvent(state,logComplete);

  const checkpointRequest=buildEvent(state,{
    source:"operator",kind:"dossier.checkpoint.requested",phase:state.phase,
    dossierTransparencyId:e.id,message:"checkpoint"
  });
  state=projectEvent(state,checkpointRequest);
  const chk=checkpoint(e);
  const checkpointComplete=buildEvent(state,{
    source:"tool",kind:"dossier.checkpoint.completed",phase:state.phase,
    dossierTransparencyId:e.id,dossierCheckpoint:chk,dossierCheckpointId:chk.id,
    message:"checkpointed"
  });
  state=projectEvent(state,checkpointComplete);

  return {
    initial,events,state,chk,
    setupEvents:[sealRequest,sealComplete,logRequest,logComplete,checkpointRequest,checkpointComplete]
  };
};

describe("RFC3161 timestamp kernel",()=>{
  it("accepts and exactly replays a matching timestamp receipt",()=>{
    const base=withCheckpoint();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.timestamp.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"timestamp"
    });
    const requested=projectEvent(base.state,request);
    const receipt=timestamp(base.chk);
    const complete=buildEvent(requested,{
      source:"tool",kind:"dossier.timestamp.completed",phase:requested.phase,
      dossierCheckpointId:base.chk.id,dossierTimestamp:receipt,message:"timestamped"
    });
    const final=projectEvent(requested,complete);

    expect(final.dossierRfc3161Timestamps).toEqual([receipt]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.setupEvents,request,complete]
    );
    expect(replayed.dossierRfc3161Timestamps).toEqual([receipt]);
  });

  it("rejects a timestamp receipt bound to the wrong checkpoint digest",()=>{
    const base=withCheckpoint();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.timestamp.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"timestamp"
    });
    const requested=projectEvent(base.state,request);
    const forged={...timestamp(base.chk),checkpointSha256:"0".repeat(64)};

    expect(()=>buildEvent(requested,{
      source:"tool",kind:"dossier.timestamp.completed",phase:requested.phase,
      dossierCheckpointId:base.chk.id,dossierTimestamp:forged,message:"forged"
    })).toThrow(/incomplete or malformed/i);
  });

  it("rejects completion without a matching operator request",()=>{
    const base=withCheckpoint();
    expect(()=>buildEvent(base.state,{
      source:"tool",kind:"dossier.timestamp.completed",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,dossierTimestamp:timestamp(base.chk),
      message:"timestamped"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects a second timestamp from the same configured authority/trust anchor",()=>{
    const base=withCheckpoint();
    const firstRequest=buildEvent(base.state,{
      source:"operator",kind:"dossier.timestamp.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"timestamp"
    });
    let state=projectEvent(base.state,firstRequest);
    const first=timestamp(base.chk);
    const firstComplete=buildEvent(state,{
      source:"tool",kind:"dossier.timestamp.completed",phase:state.phase,
      dossierCheckpointId:base.chk.id,dossierTimestamp:first,message:"timestamped"
    });
    state=projectEvent(state,firstComplete);

    const secondRequest=buildEvent(state,{
      source:"operator",kind:"dossier.timestamp.requested",phase:state.phase,
      dossierCheckpointId:base.chk.id,message:"timestamp again"
    });
    state=projectEvent(state,secondRequest);
    const second=timestamp(base.chk,"1".repeat(64));

    expect(()=>buildEvent(state,{
      source:"tool",kind:"dossier.timestamp.completed",phase:state.phase,
      dossierCheckpointId:base.chk.id,dossierTimestamp:second,message:"timestamped again"
    })).toThrow(/already timestamped/i);
  });

  it("locks timestamp requests during active governed execution",()=>{
    const base=withCheckpoint();
    const active={...base.state,phase:"independent" as const};
    expect(()=>buildEvent(active,{
      source:"operator",kind:"dossier.timestamp.requested",phase:active.phase,
      dossierCheckpointId:base.chk.id,message:"timestamp"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
