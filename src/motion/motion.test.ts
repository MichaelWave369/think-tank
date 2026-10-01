import { describe,expect,it } from "vitest";
import { createInitialState } from "../domain/state";
import { buildEvent,buildEventBatch } from "../kernel/eventKernel";
import { scenarioEventInputs } from "../sim/demo";
import { deriveMotionCue } from "./motion";

describe("motion cue projection",()=>{
  it("routes a scheduled role through its assigned seat",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(initial,scenarioEventInputs("Motion test.","council","happy"));
    const turn=events.find(event=>event.kind==="turn.started"&&event.roleId==="dreamer");
    const cue=deriveMotionCue(turn,initial);

    expect(cue.kind).toBe("route");
    expect(cue.roleId).toBe("dreamer");
    expect(cue.seatId).toBe("kimi");
  });

  it("maps a challenge to a high-intensity challenge cue",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(initial,scenarioEventInputs("Motion test.","council","happy"));
    const challenge=events.find(event=>event.kind==="challenge.raised");
    const cue=deriveMotionCue(challenge,initial);

    expect(cue.kind).toBe("challenge");
    expect(cue.intensity).toBe("high");
  });

  it("maps a passing Reality Gate score to gate-pass",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"system",
      kind:"gate.scored",
      phase:"synthesis",
      gateScore:.88,
      message:"pass"
    });
    const cue=deriveMotionCue(event,initial);
    expect(cue.kind).toBe("gate-pass");
  });

  it("maps a below-threshold Reality Gate score to gate-block",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"system",
      kind:"gate.scored",
      phase:"synthesis",
      gateScore:.52,
      message:"block"
    });
    const cue=deriveMotionCue(event,initial);
    expect(cue.kind).toBe("gate-block");
  });

  it("maps governance faults to fault cues",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"system",
      kind:"governance.fault",
      phase:"synthesis",
      faultCode:"TURN_TIMEOUT",
      message:"fault"
    });
    const cue=deriveMotionCue(event,initial);
    expect(cue.kind).toBe("fault");
    expect(cue.label).toBe("TURN_TIMEOUT");
  });

  it("stays idle before the first ledger event",()=>{
    const cue=deriveMotionCue(undefined,createInitialState());
    expect(cue.kind).toBe("idle");
    expect(cue.seq).toBe(0);
  });
});
