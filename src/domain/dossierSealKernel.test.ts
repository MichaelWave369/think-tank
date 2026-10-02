import { describe,expect,it } from "vitest";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { DossierSealReceipt,ThinkTankState } from "./types";
import { buildEvent,buildEventBatch,replayEvents } from "../kernel/eventKernel";
import { scenarioEventInputs } from "../sim/demo";

const withDossier=()=>{
  const initial=createInitialState();
  const events=buildEventBatch(
    initial,
    scenarioEventInputs("Seal test.","council","council-gate-block",initial)
  );
  const state=events.reduce(projectEvent,initial);
  const dossier=state.decisionDossiers[0]!;
  return {initial,events,state,dossier};
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

const requestSeal=(state:ThinkTankState,dossierId:string)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"dossier.seal.requested",
    phase:state.phase,
    decisionDossierId:dossierId,
    message:"request seal"
  });
  return {event,state:projectEvent(state,event)};
};

const completeSeal=(state:ThinkTankState,seal:DossierSealReceipt)=>{
  const event=buildEvent(state,{
    source:"tool",
    kind:"dossier.seal.completed",
    phase:state.phase,
    decisionDossierId:seal.dossierId,
    dossierSeal:seal,
    message:"seal complete"
  });
  return {event,state:projectEvent(state,event)};
};

describe("dossier seal kernel",()=>{
  it("replays a governed seal receipt exactly",()=>{
    const base=withDossier();
    const requested=requestSeal(base.state,base.dossier.id);
    const sealed=completeSeal(requested.state,fakeSeal(base.dossier.id));

    const replayed=replayEvents(
      createInitialState(),
      [...base.events,requested.event,sealed.event]
    );

    expect(replayed.dossierSeals).toEqual(sealed.state.dossierSeals);
    expect(replayed.dossierSeals).toHaveLength(1);
  });

  it("rejects a seal completion without operator request",()=>{
    const base=withDossier();

    expect(()=>completeSeal(base.state,fakeSeal(base.dossier.id)))
      .toThrow(/no matching operator request/i);
  });

  it("rejects malformed seal digests",()=>{
    const base=withDossier();
    const requested=requestSeal(base.state,base.dossier.id);
    const forged={...fakeSeal(base.dossier.id),digestSha256:"bad"};

    expect(()=>completeSeal(requested.state,forged))
      .toThrow(/incomplete or malformed/i);
  });

  it("rejects a second seal from the same signer key for one dossier",()=>{
    const base=withDossier();
    const firstRequest=requestSeal(base.state,base.dossier.id);
    const first=completeSeal(firstRequest.state,fakeSeal(base.dossier.id));

    const secondRequest=requestSeal(first.state,base.dossier.id);

    expect(()=>completeSeal(secondRequest.state,fakeSeal(base.dossier.id)))
      .toThrow(/signer key already sealed/i);
  });

  it("allows a second independent signer key",()=>{
    const base=withDossier();
    const firstRequest=requestSeal(base.state,base.dossier.id);
    const first=completeSeal(firstRequest.state,fakeSeal(base.dossier.id,"a".repeat(64)));
    const secondRequest=requestSeal(first.state,base.dossier.id);
    const second=completeSeal(secondRequest.state,fakeSeal(base.dossier.id,"c".repeat(64)));

    expect(second.state.dossierSeals).toHaveLength(2);
    expect(second.state.dossierSeals.map(item=>item.publicKeyFingerprintSha256))
      .toEqual(["a".repeat(64),"c".repeat(64)]);
  });

  it("requires verification to reference an existing seal",()=>{
    const base=withDossier();

    expect(()=>buildEvent(base.state,{
      source:"operator",
      kind:"dossier.verify.requested",
      phase:base.state.phase,
      dossierSealId:"SEAL-MISSING",
      decisionDossierId:base.dossier.id,
      message:"verify"
    })).toThrow(/existing seal and dossier/i);
  });

  it("accepts a matching tool verification receipt and replays it",()=>{
    const base=withDossier();
    const requested=requestSeal(base.state,base.dossier.id);
    const sealed=completeSeal(requested.state,fakeSeal(base.dossier.id));
    const seal=sealed.state.dossierSeals[0]!;

    const verifyRequest=buildEvent(sealed.state,{
      source:"operator",
      kind:"dossier.verify.requested",
      phase:sealed.state.phase,
      decisionDossierId:base.dossier.id,
      dossierSealId:seal.id,
      message:"verify"
    });
    const verifyRequested=projectEvent(sealed.state,verifyRequest);

    const verification=buildEvent(verifyRequested,{
      source:"tool",
      kind:"dossier.verify.completed",
      phase:verifyRequested.phase,
      decisionDossierId:base.dossier.id,
      dossierSealId:seal.id,
      dossierVerification:{
        id:"VER-1",
        dossierId:base.dossier.id,
        sealId:seal.id,
        tool:"ed25519-dossier-verifier",
        algorithm:"Ed25519",
        digestSha256:seal.digestSha256,
        publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
        verified:true,
        verifiedAt:"2026-10-01T22:01:00.000Z"
      },
      message:"valid"
    });
    const final=projectEvent(verifyRequested,verification);

    expect(final.dossierSealVerifications).toHaveLength(1);
    const replayed=replayEvents(
      createInitialState(),
      [...base.events,requested.event,sealed.event,verifyRequest,verification]
    );
    expect(replayed.dossierSealVerifications).toEqual(final.dossierSealVerifications);
  });

  it("rejects verification receipt digest mismatch",()=>{
    const base=withDossier();
    const requested=requestSeal(base.state,base.dossier.id);
    const sealed=completeSeal(requested.state,fakeSeal(base.dossier.id));
    const seal=sealed.state.dossierSeals[0]!;

    const verifyRequest=buildEvent(sealed.state,{
      source:"operator",
      kind:"dossier.verify.requested",
      phase:sealed.state.phase,
      decisionDossierId:base.dossier.id,
      dossierSealId:seal.id,
      message:"verify"
    });
    const verifyRequested=projectEvent(sealed.state,verifyRequest);

    expect(()=>buildEvent(verifyRequested,{
      source:"tool",
      kind:"dossier.verify.completed",
      phase:verifyRequested.phase,
      decisionDossierId:base.dossier.id,
      dossierSealId:seal.id,
      dossierVerification:{
        id:"VER-2",
        dossierId:base.dossier.id,
        sealId:seal.id,
        tool:"ed25519-dossier-verifier",
        algorithm:"Ed25519",
        digestSha256:"0".repeat(64),
        publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
        verified:false,
        verifiedAt:"2026-10-01T22:01:00.000Z"
      },
      message:"invalid"
    })).toThrow(/does not match its seal/i);
  });

  it("locks seal operations during active governed execution",()=>{
    const base=withDossier();
    const active={...base.state,phase:"independent" as const};

    expect(()=>requestSeal(active,base.dossier.id))
      .toThrow(/cannot run during active governed execution/i);
  });
});
