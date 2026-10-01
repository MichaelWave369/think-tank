import { describe,expect,it } from "vitest";
import { seats } from "../data/terminals";
import { createInitialState } from "../domain/state";
import type { ThinkTankState } from "../domain/types";
import { replayEvents } from "../kernel/eventKernel";
import { runLiveProviderSession } from "./liveRunner";
import { buildRoleMessages } from "./rolePrompts";

const localSoloState=():ThinkTankState=>({
  ...createInitialState(),
  mode:"solo",
  routerPolicy:"manual",
  seatStatus:{openai:"offline",kimi:"offline",local:"online"}
});

describe("LIVE provider runner",()=>{
  it("executes a real-provider shaped SOLO run and replays exactly",async()=>{
    const initial=localSoloState();
    const events=[] as Parameters<typeof replayEvents>[1];

    const result=await runLiveProviderSession({
      initialState:initial,
      seats,
      prompt:"Design a small governed test.",
      localModel:"qwen-test",
      invoke:async request=>({
        ok:true,
        seatId:request.seatId,
        provider:"Ollama",
        model:request.model||"qwen-test",
        text:"Candidate synthesis from a fake provider transport.",
        latencyMs:12,
        requestId:"req-test"
      }),
      apply:event=>events.push(event)
    });

    expect(result.completed).toBe(true);
    expect(result.aborted).toBe(false);
    expect(result.state.gateScore).toBe(.65);
    expect(result.state.outputLabel).toBe("STANDARD");

    const providerEvent=events.find(event=>event.source==="provider");
    expect(providerEvent?.seatId).toBe("local");
    expect(providerEvent?.providerModel).toBe("qwen-test");
    expect(providerEvent?.providerLatencyMs).toBe(12);
    expect(providerEvent?.providerRequestId).toBe("req-test");

    const replayed=replayEvents(localSoloState(),events);
    expect(replayed.events).toHaveLength(events.length);
    expect(replayed.lastUtterance.vessie).toBe(result.state.lastUtterance.vessie);
    expect(replayed.gateScore).toBe(.65);
  });

  it("turns provider transport failure into a governed withheld state",async()=>{
    const initial=localSoloState();
    const events=[] as Parameters<typeof replayEvents>[1];

    const result=await runLiveProviderSession({
      initialState:initial,
      seats,
      prompt:"Trigger the failure path.",
      localModel:"qwen-test",
      invoke:async()=>{throw new Error("Local model unavailable.");},
      apply:event=>events.push(event)
    });

    expect(result.completed).toBe(false);
    expect(result.error).toMatch(/Local model unavailable/);
    expect(events.some(event=>event.kind==="provider.failed")).toBe(true);
    expect(events.some(event=>event.kind==="governance.fault")).toBe(true);
    expect(events[events.length-1]?.kind).toBe("synthesis.withheld");
    expect(result.state.synthesisWithheld).toBe(true);
    expect(result.state.faultCode).toBe("PROVIDER_FAILED");
  });

  it("fails closed at Reality Gate for threshold-gated LIVE Council",async()=>{
    const initial=createInitialState();
    const events=[] as Parameters<typeof replayEvents>[1];

    const result=await runLiveProviderSession({
      initialState:initial,
      seats,
      prompt:"Run a council.",
      localModel:"local-test",
      invoke:async request=>({
        ok:true,
        seatId:request.seatId,
        provider:request.seatId==="local"?"Ollama":request.seatId==="openai"?"OpenAI":"Kimi",
        model:request.model||"remote-test",
        text:request.roleId.toUpperCase()+" live output.",
        latencyMs:5
      }),
      apply:event=>events.push(event)
    });

    expect(result.completed).toBe(true);
    expect(result.state.gateScore).toBe(.65);
    expect(result.state.synthesisWithheld).toBe(true);
    expect(result.state.outputLabel).toBe("WITHHELD");
    expect(result.state.gateBreakdown?.cap).toBe(.65);
    expect(events.filter(event=>event.source==="provider")).toHaveLength(5);
  });

  it("lets healthy Council cross the gate with two operator-attested external references",async()=>{
    const initial=createInitialState();
    initial.evidenceRefs=[
      {
        id:"EV-1",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Primary reference",
        uri:"https://example.com/primary",
        addedBy:"operator"
      },
      {
        id:"EV-2",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Independent reference",
        uri:"https://example.com/independent",
        addedBy:"operator"
      }
    ];
    const events=[] as Parameters<typeof replayEvents>[1];

    const result=await runLiveProviderSession({
      initialState:initial,
      seats,
      prompt:"Run an evidenced council.",
      localModel:"local-test",
      invoke:async request=>({
        ok:true,
        seatId:request.seatId,
        provider:request.seatId==="local"?"Ollama":request.seatId==="openai"?"OpenAI":"Kimi",
        model:request.model||"remote-test",
        text:request.roleId.toUpperCase()+" evidenced output.",
        latencyMs:5
      }),
      apply:event=>events.push(event)
    });

    expect(result.state.gateScore).toBe(.8775);
    expect(result.state.gateBreakdown?.attestedEvidenceCount).toBe(2);
    expect(result.state.synthesisWithheld).toBe(false);
    expect(result.state.actionAllowed).toBe(true);
  });
});

describe("provider-neutral role prompts",()=>{
  it("keeps role identity separate from provider identity",()=>{
    const messages=buildRoleMessages(
      "challenger",
      "council",
      "Evaluate this claim.",
      {dreamer:"A speculative connection.",builder:"A proposed implementation."}
    );

    expect(messages[0].content).toMatch(/staffing CHALLENGER/);
    expect(messages[0].content).not.toMatch(/OpenAI|Kimi|Ollama/);
    expect(messages[1].content).toMatch(/DREAMER: A speculative connection/);
    expect(messages[1].content).toMatch(/BUILDER: A proposed implementation/);
  });
});
