import {describe,expect,it} from "vitest";
import {projectEvent} from "./reducer";
import {createInitialState} from "./state";
import type {
  DossierCheckpointPublicationReceipt,
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
  signedAt:"2026-10-02T01:00:00.000Z",
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
  loggedAt:"2026-10-02T01:01:00.000Z",
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
  createdAt:"2026-10-02T01:02:00.000Z",
  clock:"untrusted-local-clock",
  trust:"portable-local-checkpoint"
});

const publication=(
  chk:DossierTransparencyCheckpoint,
  publisherUrl="https://api.example.test/publish",
  receiptSha="e".repeat(64)
):DossierCheckpointPublicationReceipt=>({
  id:"PUB-"+chk.id+"-"+receiptSha.slice(0,12),
  checkpointId:chk.id,
  tool:"verified-checkpoint-publisher",
  protocol:"phi-checkpoint-publication-v1",
  checkpointSha256:chk.checkpointSha256,
  publisherUrl,
  retrievalUrl:"https://public.example.test/checkpoints/"+chk.id+".json",
  publicationId:"publication-001",
  publisherClaimedAt:"2026-10-02T01:03:00.000Z",
  payloadSha256:"f".repeat(64),
  retrievalHttpStatus:200,
  retrievalContentType:"application/json",
  retrievalVerifiedAt:"2026-10-02T01:03:01.000Z",
  receiptSha256:receiptSha,
  trust:"externally-retrieved-publication"
});

const withCheckpoint=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Publication test.","council","council-gate-block",initial)
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
    initial,
    events,
    state,
    chk,
    setupEvents:[
      sealRequest,sealComplete,logRequest,logComplete,checkpointRequest,checkpointComplete
    ]
  };
};

describe("verified checkpoint publication kernel",()=>{
  it("accepts and exactly replays a verified publication receipt",()=>{
    const base=withCheckpoint();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.publication.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"publish"
    });
    const requested=projectEvent(base.state,request);
    const receipt=publication(base.chk);
    const complete=buildEvent(requested,{
      source:"tool",kind:"dossier.publication.completed",phase:requested.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:receipt,message:"published"
    });
    const final=projectEvent(requested,complete);

    expect(final.dossierCheckpointPublications).toEqual([receipt]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.setupEvents,request,complete]
    );
    expect(replayed.dossierCheckpointPublications).toEqual([receipt]);
  });

  it("rejects a publication bound to the wrong checkpoint digest",()=>{
    const base=withCheckpoint();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.publication.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"publish"
    });
    const requested=projectEvent(base.state,request);
    const forged={...publication(base.chk),checkpointSha256:"0".repeat(64)};

    expect(()=>buildEvent(requested,{
      source:"tool",kind:"dossier.publication.completed",phase:requested.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:forged,message:"forged"
    })).toThrow(/incomplete or malformed/i);
  });

  it("rejects completion without a matching operator request",()=>{
    const base=withCheckpoint();
    expect(()=>buildEvent(base.state,{
      source:"tool",kind:"dossier.publication.completed",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:publication(base.chk),
      message:"published"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects a second accepted publication from the same publisher",()=>{
    const base=withCheckpoint();
    const firstRequest=buildEvent(base.state,{
      source:"operator",kind:"dossier.publication.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"publish"
    });
    let state=projectEvent(base.state,firstRequest);
    const first=publication(base.chk);
    const firstComplete=buildEvent(state,{
      source:"tool",kind:"dossier.publication.completed",phase:state.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:first,message:"published"
    });
    state=projectEvent(state,firstComplete);

    const secondRequest=buildEvent(state,{
      source:"operator",kind:"dossier.publication.requested",phase:state.phase,
      dossierCheckpointId:base.chk.id,message:"publish again"
    });
    state=projectEvent(state,secondRequest);
    const second=publication(
      base.chk,
      first.publisherUrl,
      "1".repeat(64)
    );

    expect(()=>buildEvent(state,{
      source:"tool",kind:"dossier.publication.completed",phase:state.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:second,
      message:"published again"
    })).toThrow(/publisher already has an accepted publication/i);
  });

  it("rejects non-HTTPS publication receipts",()=>{
    const base=withCheckpoint();
    const request=buildEvent(base.state,{
      source:"operator",kind:"dossier.publication.requested",phase:base.state.phase,
      dossierCheckpointId:base.chk.id,message:"publish"
    });
    const requested=projectEvent(base.state,request);
    const insecure={...publication(base.chk),retrievalUrl:"http://public.example.test/checkpoint.json"};

    expect(()=>buildEvent(requested,{
      source:"tool",kind:"dossier.publication.completed",phase:requested.phase,
      dossierCheckpointId:base.chk.id,dossierPublication:insecure,message:"insecure"
    })).toThrow(/incomplete or malformed/i);
  });

  it("locks publication during active governed execution",()=>{
    const base=withCheckpoint();
    const active={...base.state,phase:"independent" as const};
    expect(()=>buildEvent(active,{
      source:"operator",kind:"dossier.publication.requested",phase:active.phase,
      dossierCheckpointId:base.chk.id,message:"publish"
    })).toThrow(/cannot run during active governed execution/i);
  });
});
