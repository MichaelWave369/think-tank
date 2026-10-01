import { describe,expect,it } from "vitest";
import { seats } from "../data/terminals";
import { buildEvent,buildEventBatch,replayEvents } from "../kernel/eventKernel";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import { planAssignments,routingEventInputs,scoreSeatForRole } from "./craneFly";

describe("Crane Fly assignment engine",()=>{
  it("produces the deterministic Council staffing plan",()=>{
    const plan=planAssignments(createInitialState(),seats,"council");
    const byRole=Object.fromEntries(plan.decisions.map(decision=>[decision.roleId,decision.seatId]));

    expect(plan.unresolved).toEqual([]);
    expect(byRole).toEqual({
      dreamer:"kimi",
      builder:"local",
      challenger:"openai",
      archivist:"kimi",
      vessie:"openai"
    });
  });

  it("returns the same plan from the same state",()=>{
    const state=createInitialState();
    expect(planAssignments(state,seats,"council")).toEqual(planAssignments(state,seats,"council"));
  });

  it("treats an operator pin as authoritative",()=>{
    const state=createInitialState();
    state.pinnedAssignments={builder:"kimi"};

    const plan=planAssignments(state,seats,"build");
    const builder=plan.decisions.find(decision=>decision.roleId==="builder");

    expect(builder?.seatId).toBe("kimi");
    expect(builder?.origin).toBe("operator-pin");
    expect(builder?.reason).toMatch(/authoritative/i);
  });

  it("does not silently override a pin when its seat is offline",()=>{
    const state=createInitialState();
    state.pinnedAssignments={builder:"kimi"};
    state.seatStatus={...state.seatStatus,kimi:"offline"};

    const plan=planAssignments(state,seats,"build");

    expect(plan.unresolved).toContain("builder");
    expect(plan.decisions.find(decision=>decision.roleId==="builder")).toBeUndefined();
  });

  it("never auto-assigns an offline seat",()=>{
    const state=createInitialState();
    state.seatStatus={...state.seatStatus,openai:"offline"};

    const plan=planAssignments(state,seats,"council");

    expect(plan.decisions.some(decision=>decision.seatId==="openai")).toBe(false);
    expect(plan.unresolved).toEqual([]);
  });

  it("penalizes a degraded seat relative to its online score",()=>{
    const online=createInitialState();
    const degraded=createInitialState();
    degraded.seatStatus={...degraded.seatStatus,kimi:"degraded"};
    const kimi=seats.find(seat=>seat.id==="kimi")!;

    expect(scoreSeatForRole("dreamer",kimi,degraded)).toBeLessThan(
      scoreSeatForRole("dreamer",kimi,online)
    );
  });

  it("emits assignment receipts that replay exactly",()=>{
    const initial=createInitialState();
    const plan=planAssignments(initial,seats,"council");
    const events=buildEventBatch(initial,routingEventInputs(plan));
    const live=events.reduce(projectEvent,initial);
    const replayed=replayEvents(createInitialState(),events);

    expect(replayed.assignments).toEqual(live.assignments);
    expect(replayed.assignmentScores).toEqual(live.assignmentScores);
    expect(replayed.assignmentOrigins.challenger).toBe("auto");
    expect(replayed.assignmentReasons.builder).toMatch(/Best available fit/i);
  });
});

describe("Crane Fly kernel invariants",()=>{
  it("rejects an assignment that contradicts an operator pin",()=>{
    let state=createInitialState();
    const pin=buildEvent(state,{
      source:"operator",
      kind:"role.pinned",
      phase:"routing",
      roleId:"builder",
      seatId:"local",
      message:"pin"
    });
    state=projectEvent(state,pin);

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"role.assigned",
      phase:"routing",
      roleId:"builder",
      seatId:"openai",
      assignmentScore:4.5,
      assignmentOrigin:"auto",
      assignmentReason:"Forged alternate assignment.",
      message:"bad route"
    })).toThrow(/violates operator pin/i);
  });

  it("rejects assignment to an offline seat",()=>{
    let state=createInitialState();
    const offline=buildEvent(state,{
      source:"operator",
      kind:"seat.status",
      phase:"routing",
      seatId:"kimi",
      seatStatus:"offline",
      message:"offline"
    });
    state=projectEvent(state,offline);

    expect(()=>buildEvent(state,{
      source:"system",
      kind:"role.assigned",
      phase:"routing",
      roleId:"dreamer",
      seatId:"kimi",
      assignmentScore:4.8,
      assignmentOrigin:"auto",
      assignmentReason:"Should be rejected.",
      message:"bad route"
    })).toThrow(/offline seat/i);
  });
});
