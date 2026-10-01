import { describe,expect,it } from "vitest";
import { MODE_MATRIX } from "./modes";
import { createInitialState } from "./state";
import { evaluateClaimGovernance } from "./claimGovernance";
import { evaluateGovernance,initialTurnPlan } from "./scheduler";
import { projectEvent } from "./reducer";
import type { ThinkTankState } from "./types";
import { buildEvent,buildEventBatch,replayEvents } from "../kernel/eventKernel";
import { scenarioEventInputs } from "../sim/demo";

describe("mode laws",()=>{
  it("defines an executable scheduler law for all seven operator modes",()=>{
    expect(MODE_MATRIX).toHaveLength(7);

    for(const law of MODE_MATRIX){
      const plan=initialTurnPlan(law.id);
      expect(plan.speakerQueue.length).toBeGreaterThan(0);
      expect(plan.activeRoles.length).toBeGreaterThan(0);
      expect(plan.maxRounds).toBeGreaterThanOrEqual(1);
      expect(plan.timeoutMs).toBeGreaterThan(0);
      expect(plan.gateBehavior).toBe(law.gateBehavior);
    }

    expect(initialTurnPlan("debate").maxRounds).toBe(3);
  });

  it("withholds COUNCIL below the Reality Gate threshold",()=>{
    const decision=evaluateGovernance("council",.52,.75,1);
    expect(decision.synthesisAllowed).toBe(false);
    expect(decision.outputLabel).toBe("WITHHELD");
    expect(decision.actionAllowed).toBe(false);
  });

  it("keeps DREAM speculative even when the gate is informational",()=>{
    const decision=evaluateGovernance("dream",.2,.75,0);
    expect(decision.synthesisAllowed).toBe(true);
    expect(decision.outputLabel).toBe("SPECULATIVE");
    expect(decision.actionAllowed).toBe(false);
  });

  it("keeps low-evidence BUILD output as a non-actionable draft",()=>{
    const decision=evaluateGovernance("build",.5,.75,1);
    expect(decision.synthesisAllowed).toBe(true);
    expect(decision.outputLabel).toBe("DRAFT");
    expect(decision.actionAllowed).toBe(false);
  });

  it("requires an objection in DEBATE before synthesis",()=>{
    const decision=evaluateGovernance("debate",.9,.75,0);
    expect(decision.synthesisAllowed).toBe(false);
    expect(decision.reason).toMatch(/objection/i);
  });

  it("requires AUDIT to pass the gate before action is authorized",()=>{
    expect(evaluateGovernance("audit",.6,.75,1).actionAllowed).toBe(false);
    expect(evaluateGovernance("audit",.9,.75,1).actionAllowed).toBe(true);
  });

  it("withholds high-scoring COUNCIL when required claim reviews are missing",()=>{
    const state=createInitialState();
    state.claims=[{id:"CL-1",text:"Unreviewed council claim.",addedBy:"operator"}];
    const claimPolicy=evaluateClaimGovernance(state,"council");

    const decision=evaluateGovernance("council",.9,.75,1,false,claimPolicy);

    expect(claimPolicy.passed).toBe(false);
    expect(decision.synthesisAllowed).toBe(false);
    expect(decision.actionAllowed).toBe(false);
    expect(decision.reason).toMatch(/missing review/i);
  });

  it("downgrades BUILD to DRAFT when numeric Gate passes but claim policy fails",()=>{
    const state=createInitialState();
    state.claims=[{id:"CL-1",text:"Bound build claim.",addedBy:"operator"}];
    state.evidenceRefs=[{
      id:"EV-1",
      kind:"operator-reference",
      verification:"operator-attested",
      label:"Evidence",
      addedBy:"operator"
    }];
    state.claimBindings=[{
      id:"CB-1",
      claimId:"CL-1",
      evidenceId:"EV-1",
      relation:"supports",
      addedBy:"operator"
    }];

    const claimPolicy=evaluateClaimGovernance(state,"build");
    const decision=evaluateGovernance("build",.9,.75,1,false,claimPolicy);

    expect(claimPolicy.passed).toBe(false);
    expect(decision.synthesisAllowed).toBe(true);
    expect(decision.outputLabel).toBe("DRAFT");
    expect(decision.actionAllowed).toBe(false);
  });

  it("executes and exactly replays the happy path for every mode",()=>{
    for(const law of MODE_MATRIX){
      const initial:ThinkTankState={...createInitialState(),mode:law.id,routerPolicy:law.router};
      const events=buildEventBatch(initial,scenarioEventInputs("Mode law test.",law.id,"happy"));
      const final=events.reduce(projectEvent,initial);
      const replayed=replayEvents(initial,events);

      expect(replayed.outputLabel).toBe(final.outputLabel);
      expect(replayed.actionAllowed).toBe(final.actionAllowed);
      expect(replayed.synthesisWithheld).toBe(final.synthesisWithheld);
    }
  });
});

describe("scheduler enforcement",()=>{
  it("rejects an out-of-order speaker",()=>{
    let state=createInitialState();

    for(const input of [
      {source:"system" as const,kind:"session.started" as const,phase:"routing" as const,message:"start"},
      {source:"system" as const,kind:"schedule.planned" as const,phase:"routing" as const,turnPlan:initialTurnPlan("council"),message:"plan"},
      {source:"system" as const,kind:"round.started" as const,phase:"independent" as const,round:1,message:"round"}
    ]){
      const event=buildEvent(state,input);
      state=projectEvent(state,event);
    }

    expect(()=>buildEvent(state,{
      source:"simulator",
      kind:"turn.started",
      phase:"independent",
      roleId:"builder",
      message:"Builder attempts to skip Dreamer."
    })).toThrow(/Turn order violation/);
  });

  it("rejects gate scoring before the scheduled queue is complete",()=>{
    let state=createInitialState();

    for(const input of [
      {source:"system" as const,kind:"session.started" as const,phase:"routing" as const,message:"start"},
      {source:"system" as const,kind:"schedule.planned" as const,phase:"routing" as const,turnPlan:initialTurnPlan("council"),message:"plan"},
      {source:"system" as const,kind:"round.started" as const,phase:"independent" as const,round:1,message:"round"}
    ]){
      const event=buildEvent(state,input);
      state=projectEvent(state,event);
    }

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"gate.scored",
      phase:"synthesis",
      gateScore:.9,
      message:"Too early."
    })).toThrow(/before the scheduled queue completes/);
  });

  it("rejects rounds beyond the selected mode cap",()=>{
    let state:ThinkTankState={...createInitialState(),mode:"solo",routerPolicy:"manual"};

    const prefix=[
      {source:"system" as const,kind:"session.started" as const,phase:"routing" as const,message:"start"},
      {source:"system" as const,kind:"schedule.planned" as const,phase:"routing" as const,turnPlan:initialTurnPlan("solo"),message:"plan"},
      {source:"system" as const,kind:"round.started" as const,phase:"independent" as const,round:1,message:"round"},
      {source:"simulator" as const,kind:"turn.started" as const,phase:"independent" as const,roleId:"vessie" as const,message:"turn"},
      {source:"simulator" as const,kind:"utterance.complete" as const,phase:"independent" as const,roleId:"vessie" as const,message:"done"}
    ];

    for(const input of prefix){
      const event=buildEvent(state,input);
      state=projectEvent(state,event);
    }

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"round.started",
      phase:"independent",
      round:2,
      message:"Illegal second round."
    })).toThrow(/Round cap exceeded/);
  });

  it("produces a faulted timeout drill that withholds synthesis",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(initial,scenarioEventInputs("Timeout drill.","council","timeout"));
    const final=events.reduce(projectEvent,initial);

    expect(final.faultCode).toBe("TURN_TIMEOUT");
    expect(final.synthesisWithheld).toBe(true);
    expect(final.outputLabel).toBe("WITHHELD");
  });

  it("produces the canonical Council gate-block drill",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(initial,scenarioEventInputs("Gate drill.","council","council-gate-block"));
    const final=events.reduce(projectEvent,initial);

    expect(final.gateScore).toBe(.52);
    expect(final.synthesisWithheld).toBe(true);
    expect(final.actionAllowed).toBe(false);
  });
});
