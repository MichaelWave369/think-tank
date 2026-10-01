import { describe,expect,it } from "vitest";
import { evaluateEvidence } from "./evidence";
import { createInitialState } from "./state";
import type { EvidenceRef,ThinkTankEvent,ThinkTankState } from "./types";
import { initialTurnPlan } from "./scheduler";

const completedCouncilState=(refs:EvidenceRef[]=[]):ThinkTankState=>{
  const state=createInitialState();
  state.turnPlan=initialTurnPlan("council");
  state.currentRound=1;
  state.speakerIndex=state.turnPlan.speakerQueue.length;
  state.objectionCount=1;
  state.evidenceRefs=refs;

  const seatsByRole={
    dreamer:"kimi",
    builder:"local",
    challenger:"openai",
    archivist:"kimi",
    vessie:"openai"
  } as const;

  state.events=state.turnPlan.speakerQueue.map((roleId,index)=>({
    schemaVersion:1,
    sessionId:state.sessionId,
    seq:index+1,
    seed:state.seed,
    source:"provider",
    mode:"council",
    kind:roleId==="challenger"?"challenge.raised":"utterance.complete",
    phase:roleId==="challenger"?"challenge":roleId==="vessie"?"synthesis":"independent",
    roleId,
    seatId:seatsByRole[roleId],
    providerModel:"fixture-model",
    providerLatencyMs:10,
    message:roleId+" output",
    stateBefore:"fixture",
    stateAfter:"fixture"
  } satisfies ThinkTankEvent));

  return state;
};

const attested=(id:string):EvidenceRef=>({
  id,
  kind:"operator-reference",
  verification:"operator-attested",
  label:"Operator evidence "+id,
  uri:"https://example.com/"+id,
  addedBy:"operator"
});

describe("Reality Gate evidence scoring",()=>{
  it("caps model output alone at 0.65",()=>{
    const score=evaluateEvidence(completedCouncilState());

    expect(score.rawScore).toBe(.65);
    expect(score.finalScore).toBe(.65);
    expect(score.cap).toBe(.65);
    expect(score.capReason).toMatch(/model output alone/i);
  });

  it("caps one operator attestation below the normal threshold",()=>{
    const score=evaluateEvidence(completedCouncilState([attested("EV-1")]));

    expect(score.rawScore).toBeGreaterThan(.75);
    expect(score.finalScore).toBe(.74);
    expect(score.cap).toBe(.74);
    expect(score.attestedEvidenceCount).toBe(1);
  });

  it("allows two operator attestations to cross the normal threshold when the run is healthy",()=>{
    const score=evaluateEvidence(completedCouncilState([attested("EV-1"),attested("EV-2")]));

    expect(score.cap).toBe(1);
    expect(score.externalSupport).toBe(.65);
    expect(score.finalScore).toBe(.8775);
    expect(score.finalScore).toBeGreaterThan(.75);
  });

  it("weights machine-verified evidence above operator attestation",()=>{
    const verified:EvidenceRef={
      id:"EV-V",
      kind:"tool-result",
      verification:"machine-verified",
      label:"Verified tool result",
      addedBy:"system"
    };

    const oneVerified=evaluateEvidence(completedCouncilState([verified]));
    const oneAttested=evaluateEvidence(completedCouncilState([attested("EV-A")]));

    expect(oneVerified.externalSupport).toBeGreaterThan(oneAttested.externalSupport);
    expect(oneVerified.cap).toBe(1);
  });

  it("does not mistake seat consensus for external evidence",()=>{
    const score=evaluateEvidence(completedCouncilState());

    expect(score.seatDiversity).toBe(1);
    expect(score.externalSupport).toBe(0);
    expect(score.finalScore).toBeLessThan(.75);
  });
});
