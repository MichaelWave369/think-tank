import { describe,expect,it } from "vitest";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { DossierSealReceipt,DossierTransparencyReceipt,ThinkTankState } from "./types";
import { buildEvent,buildEventBatch,replayEvents } from "../kernel/eventKernel";
import { scenarioEventInputs } from "../sim/demo";

const withDossier=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Transparency test.","council","council-gate-block",initial)
  );
  const state=events.reduce(projectEvent,initial);
  return {initial,events,state,dossier:state.decisionDossiers[0]!};
};

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

const fakeTransparency=(
  seal:DossierSealReceipt,
  sequence=1,
  previousEntrySha256="0".repeat(64),
  entrySha256="c".repeat(64)
):DossierTransparencyReceipt=>({
  id:"TLOG-"+String(sequence).padStart(6,"0")+"-"+entrySha256.slice(0,12),
  dossierId:seal.dossierId,
  sealId:seal.id,
  tool:"sha256-dossier-transparency-journal",
  canonicalization:"json-stable-v1",
  sequence,
  previousEntrySha256,
  entrySha256,
  dossierSha256:seal.digestSha256,
  publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
  loggedAt:"2026-10-01T22:02:00.000Z",
  clock:"untrusted-local-clock",
  trust:"tamper-evident-local-journal",
  journalVerifiedAtAppend:true
});

const withSeal=()=>{
  const base=withDossier();
  const request=buildEvent(base.state,{
    source:"operator",kind:"dossier.seal.requested",phase:base.state.phase,
    decisionDossierId:base.dossier.id,message:"seal"
  });
  const requested=projectEvent(base.state,request);
  const seal=fakeSeal(base.dossier.id);
  const complete=buildEvent(requested,{
    source:"tool",kind:"dossier.seal.completed",phase:requested.phase,
    decisionDossierId:base.dossier.id,dossierSeal:seal,message:"sealed"
  });
  const state=projectEvent(requested,complete);
  return {...base,seal,state,sealEvents:[request,complete]};
};

const requestTransparency=(state:ThinkTankState,seal:DossierSealReceipt)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"dossier.transparency.requested",
    phase:state.phase,
    decisionDossierId:seal.dossierId,
    dossierSealId:seal.id,
    message:"append"
  });
  return {event,state:projectEvent(state,event)};
};

describe("dossier transparency journal kernel",()=>{
  it("replays a governed transparency receipt exactly",()=>{
    const base=withSeal();
    const request=requestTransparency(base.state,base.seal);
    const receipt=fakeTransparency(base.seal);
    const complete=buildEvent(request.state,{
      source:"tool",kind:"dossier.transparency.completed",phase:request.state.phase,
      decisionDossierId:base.seal.dossierId,dossierSealId:base.seal.id,
      dossierTransparency:receipt,message:"logged"
    });
    const final=projectEvent(request.state,complete);

    expect(final.dossierTransparencyEntries).toEqual([receipt]);

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,...base.sealEvents,request.event,complete]
    );
    expect(replayed.dossierTransparencyEntries).toEqual([receipt]);
  });

  it("rejects completion without an operator request",()=>{
    const base=withSeal();
    expect(()=>buildEvent(base.state,{
      source:"tool",kind:"dossier.transparency.completed",phase:base.state.phase,
      decisionDossierId:base.seal.dossierId,dossierSealId:base.seal.id,
      dossierTransparency:fakeTransparency(base.seal),message:"logged"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects a second append request for the same seal",()=>{
    const base=withSeal();
    const request=requestTransparency(base.state,base.seal);
    const receipt=fakeTransparency(base.seal);
    const complete=buildEvent(request.state,{
      source:"tool",kind:"dossier.transparency.completed",phase:request.state.phase,
      decisionDossierId:base.seal.dossierId,dossierSealId:base.seal.id,
      dossierTransparency:receipt,message:"logged"
    });
    const logged=projectEvent(request.state,complete);

    expect(()=>requestTransparency(logged,base.seal))
      .toThrow(/already present in the transparency journal/i);
  });

  it("requires later accepted entries to extend the current chain",()=>{
    const base=withSeal();
    const firstRequest=requestTransparency(base.state,base.seal);
    const firstReceipt=fakeTransparency(base.seal);
    const firstComplete=buildEvent(firstRequest.state,{
      source:"tool",kind:"dossier.transparency.completed",phase:firstRequest.state.phase,
      decisionDossierId:base.seal.dossierId,dossierSealId:base.seal.id,
      dossierTransparency:firstReceipt,message:"logged"
    });
    let state=projectEvent(firstRequest.state,firstComplete);

    const secondSeal=fakeSeal(base.dossier.id,"d".repeat(64));
    const sealRequest=buildEvent(state,{
      source:"operator",kind:"dossier.seal.requested",phase:state.phase,
      decisionDossierId:base.dossier.id,message:"seal two"
    });
    state=projectEvent(state,sealRequest);
    const sealComplete=buildEvent(state,{
      source:"tool",kind:"dossier.seal.completed",phase:state.phase,
      decisionDossierId:base.dossier.id,dossierSeal:secondSeal,message:"sealed two"
    });
    state=projectEvent(state,sealComplete);

    const secondRequest=requestTransparency(state,secondSeal);
    const broken=fakeTransparency(secondSeal,2,"f".repeat(64),"e".repeat(64));

    expect(()=>buildEvent(secondRequest.state,{
      source:"tool",kind:"dossier.transparency.completed",phase:secondRequest.state.phase,
      decisionDossierId:secondSeal.dossierId,dossierSealId:secondSeal.id,
      dossierTransparency:broken,message:"broken chain"
    })).toThrow(/does not extend the latest accepted entry/i);
  });

  it("locks transparency operations during active governed execution",()=>{
    const base=withSeal();
    const active={...base.state,phase:"independent" as const};
    expect(()=>requestTransparency(active,base.seal))
      .toThrow(/cannot run during active governed execution/i);
  });
});
