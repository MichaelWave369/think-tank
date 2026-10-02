import {describe,expect,it} from "vitest";
import {createInitialState} from "./state";
import {projectEvent} from "./reducer";
import type {ThinkTankEvent} from "./types";

const event=(
  seq:number,
  kind:ThinkTankEvent["kind"],
  roleId?:ThinkTankEvent["roleId"]
):ThinkTankEvent=>({
  schemaVersion:1,
  sessionId:"PHI-0001",
  seq,
  seed:"369042",
  source:kind==="provider.failed"?"provider":"system",
  mode:"council",
  kind,
  phase:"independent",
  roleId,
  message:kind==="provider.failed"
    ?"Provider failure on BUILDER: Ollama returned no final assistant text."
    :"Builder turn started.",
  faultCode:kind==="provider.failed"?"PROVIDER_FAILED":undefined,
  stateBefore:"before",
  stateAfter:"after"
});

describe("provider failure terminal state",()=>{
  it("moves a failed speaking role to warning instead of leaving stale speaking state",()=>{
    let state=createInitialState();
    state={...state,mode:"council",phase:"independent"};

    state=projectEvent(state,event(1,"turn.started","builder"));
    expect(state.terminalStates.builder).toBe("speaking");
    expect(state.currentSpeaker).toBe("builder");

    state=projectEvent(state,event(2,"provider.failed","builder"));
    expect(state.terminalStates.builder).toBe("warning");
    expect(state.currentSpeaker).toBeNull();
    expect(state.faultCode).toBe("PROVIDER_FAILED");
  });
});
