import { describe,expect,it } from "vitest";
import { buildEvent } from "../kernel/eventKernel";
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
