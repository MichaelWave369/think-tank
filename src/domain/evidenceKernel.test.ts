import { describe,expect,it } from "vitest";
import { buildEvent,replayEvents } from "../kernel/eventKernel";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import { evaluateEvidence } from "./evidence";
import { initialTurnPlan } from "./scheduler";
import type { ThinkTankState } from "./types";

const addAttested=(state:ThinkTankState,id="EV-1")=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"evidence.added",
    phase:"intake",
    evidenceRef:{
      id,
      kind:"operator-reference",
      verification:"operator-attested",
      label:"Operator evidence",
      addedBy:"operator"
    },
    message:"add"
  });
  return projectEvent(state,event);
};

const machineRef=()=>({
  id:"EV-MACHINE",
  kind:"external-source" as const,
  verification:"machine-verified" as const,
  label:"Machine retrieved source",
  uri:"https://example.com/final",
  addedBy:"tool" as const,
  retrieval:{
    tool:"url-fetch" as const,
    requestedUri:"https://example.com/start",
    finalUri:"https://example.com/final",
    httpStatus:200,
    contentType:"text/html; charset=utf-8",
    bytes:1234,
    sha256:"a".repeat(64),
    redirects:1,
    retrievedAt:"2026-10-01T12:00:00.000Z"
  }
});

describe("evidence kernel",()=>{
  it("rejects operator evidence that claims machine verification",()=>{
    const state=createInitialState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-X",
        kind:"tool-result",
        verification:"machine-verified",
        label:"Forged verified evidence",
        addedBy:"operator"
      },
      message:"bad"
    })).toThrow(/cannot self-declare machine verification/i);
  });

  it("accepts a complete tool-originated machine verification receipt",()=>{
    const state=createInitialState();
    const event=buildEvent(state,{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:machineRef(),
      message:"verified"
    });
    const next=projectEvent(state,event);
    const replayed=replayEvents(createInitialState(),[event]);

    expect(next.evidenceRefs[0]?.verification).toBe("machine-verified");
    expect(next.evidenceRefs[0]?.retrieval?.sha256).toHaveLength(64);
    expect(replayed.evidenceRefs).toEqual(next.evidenceRefs);
  });

  it("rejects system-originated machine verification",()=>{
    const ref={...machineRef(),addedBy:"system" as const};

    expect(()=>buildEvent(createInitialState(),{
      source:"system",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:ref,
      message:"forged system verification"
    })).toThrow(/reserved for governed tool receipts/i);
  });

  it("rejects machine verification without a retrieval receipt",()=>{
    const ref=machineRef();
    const {retrieval:_,...withoutReceipt}=ref;

    expect(()=>buildEvent(createInitialState(),{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:withoutReceipt,
      message:"missing receipt"
    })).toThrow(/requires a retrieval receipt/i);
  });

  it("rejects malformed retrieval hashes",()=>{
    const ref=machineRef();
    ref.retrieval.sha256="not-a-sha";

    expect(()=>buildEvent(createInitialState(),{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:ref,
      message:"bad digest"
    })).toThrow(/SHA-256/i);
  });

  it("requires operator authority to request a machine fetch",()=>{
    expect(()=>buildEvent(createInitialState(),{
      source:"system",
      kind:"evidence.fetch.requested",
      phase:"intake",
      evidenceUri:"https://example.com",
      message:"bad request"
    })).toThrow(/operator-authorized/i);
  });

  it("requires tool provenance for fetch failure receipts",()=>{
    expect(()=>buildEvent(createInitialState(),{
      source:"operator",
      kind:"evidence.fetch.failed",
      phase:"intake",
      evidenceUri:"https://example.com",
      message:"bad failure source"
    })).toThrow(/tool-originated/i);
  });

  it("rejects duplicate evidence URIs so one source cannot inflate breadth",()=>{
    const state=addAttested(createInitialState());
    state.evidenceRefs[0]!.uri="https://example.com/source";

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-2",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Same source again",
        uri:"https://example.com/source",
        addedBy:"operator"
      },
      message:"duplicate uri"
    })).toThrow(/URI already exists/i);
  });

  it("rejects duplicate machine content digests even across different URLs",()=>{
    const state=createInitialState();
    state.evidenceRefs=[{
      id:"EV-OLD",
      kind:"external-source",
      verification:"machine-verified",
      label:"Original bytes",
      uri:"https://example.com/a",
      addedBy:"tool",
      retrieval:{
        tool:"url-fetch",
        requestedUri:"https://example.com/a",
        finalUri:"https://example.com/a",
        httpStatus:200,
        contentType:"text/plain",
        bytes:100,
        sha256:"f".repeat(64),
        redirects:0,
        retrievedAt:"2026-10-01T12:00:00.000Z"
      }
    }];

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-NEW",
        kind:"external-source",
        verification:"machine-verified",
        label:"Mirror bytes",
        uri:"https://mirror.example.com/a",
        addedBy:"tool",
        retrieval:{
          tool:"url-fetch",
          requestedUri:"https://mirror.example.com/a",
          finalUri:"https://mirror.example.com/a",
          httpStatus:200,
          contentType:"text/plain",
          bytes:100,
          sha256:"f".repeat(64),
          redirects:0,
          retrievedAt:"2026-10-01T12:01:00.000Z"
        }
      },
      message:"duplicate digest"
    })).toThrow(/duplicate provenance cannot increase breadth/i);
  });

  it("rejects duplicate evidence ids",()=>{
    const state=addAttested(createInitialState());

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-1",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Duplicate",
        addedBy:"operator"
      },
      message:"duplicate"
    })).toThrow(/already exists/i);
  });

  it("rejects removal of a missing evidence receipt",()=>{
    expect(()=>buildEvent(createInitialState(),{
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId:"EV-MISSING",
      message:"remove"
    })).toThrow(/existing evidence id/i);
  });

  it("rejects evidence mutation during an active governed session",()=>{
    const state=createInitialState();
    state.phase="independent";

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.added",
      phase:"independent",
      evidenceRef:{
        id:"EV-LATE",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Late evidence",
        addedBy:"operator"
      },
      message:"late"
    })).toThrow(/cannot mutate during an active governed session/i);
  });

  it("invalidates prior gate authorization when evidence changes",()=>{
    const state=createInitialState();
    state.gateScore=.88;
    state.gateBreakdown={
      provenance:1,
      roleCoverage:1,
      seatDiversity:1,
      challengeCoverage:1,
      externalSupport:.65,
      rawScore:.8775,
      finalScore:.8775,
      cap:1,
      capReason:"fixture",
      evidenceCount:2,
      verifiedEvidenceCount:0,
      attestedEvidenceCount:2
    };
    state.outputLabel="READY";
    state.actionAllowed=true;

    const event=buildEvent(state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-NEW",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"New evidence",
        addedBy:"operator"
      },
      message:"new evidence"
    });
    const next=projectEvent(state,event);

    expect(next.gateScore).toBeNull();
    expect(next.gateBreakdown).toBeNull();
    expect(next.actionAllowed).toBe(false);
    expect(next.outputLabel).toBeNull();
  });

  it("rejects a forged deterministic gate score",()=>{
    const state=createInitialState();
    state.turnPlan=initialTurnPlan("solo");
    state.currentRound=1;
    state.speakerIndex=1;
    const expected=evaluateEvidence(state);

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"gate.scored",
      phase:"synthesis",
      gateScore:.99,
      gateBreakdown:expected,
      message:"forged"
    })).toThrow(/score mismatch/i);
  });
});
