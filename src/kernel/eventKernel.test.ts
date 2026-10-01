import { describe,expect,it } from "vitest";
import { createInitialState } from "../domain/state";
import { scenarioEventInputs } from "../sim/demo";
import { projectEvent } from "../domain/reducer";
import { demoEventInputs } from "../sim/demo";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "./eventKernel";
import { fingerprintProjection } from "./fingerprint";

describe("event kernel",()=>{
  it("rejects a forged passing claim-governance receipt",()=>{
    const initial=createInitialState();
    initial.claims=[{id:"CL-1",text:"Unreviewed council claim.",addedBy:"operator"}];

    const inputs=scenarioEventInputs(
      "Test forged claim policy.",
      "council",
      "happy",
      initial
    );
    const prefix=inputs.slice(0,-1);
    const finalInput=inputs[inputs.length-1]!;
    const prefixEvents=buildEventBatch(initial,prefix);
    const state=prefixEvents.reduce(projectEvent,initial);
    const forged={
      ...finalInput,
      claimGovernance:{
        ...finalInput.claimGovernance!,
        passed:true,
        missingReviewClaimIds:[],
        reason:"Forged pass."
      }
    };

    expect(()=>buildEvent(state,forged)).toThrow(/claim governance receipt does not match/i);
  });
  it("replays the same ledger to the exact same projection",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(initial,demoEventInputs("Explain the current architecture."));
    const live=events.reduce(projectEvent,initial);
    const replayed=replayEvents(createInitialState(),events);

    expect(fingerprintProjection(replayed)).toBe(fingerprintProjection(live));

    const report=verifyReplay(createInitialState(),events,live);
    expect(report.valid).toBe(true);
    expect(report.exact).toBe(true);
    expect(report.eventCount).toBe(events.length);
  });

  it("rejects a sequence gap",()=>{
    const events=buildEventBatch(createInitialState(),demoEventInputs("Sequence test."));
    const dropped=events.filter(event=>event.seq!==7);

    expect(()=>replayEvents(createInitialState(),dropped))
      .toThrow(/Sequence discontinuity/);
  });

  it("rejects a session mismatch",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"operator",
      kind:"operator.prompt",
      phase:"intake",
      message:"Session mismatch test."
    });

    const tampered={...event,sessionId:"PHI-WRONG"};

    expect(()=>replayEvents(createInitialState(),[tampered]))
      .toThrow(/Session mismatch/);
  });

  it("rejects a seed mismatch",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"operator",
      kind:"operator.prompt",
      phase:"intake",
      message:"Seed mismatch test."
    });

    const tampered={...event,seed:"000000"};

    expect(()=>replayEvents(createInitialState(),[tampered]))
      .toThrow(/Seed mismatch/);
  });

  it("rejects payload tampering through the post-state fingerprint",()=>{
    const events=buildEventBatch(createInitialState(),demoEventInputs("Tamper test."));
    const tampered=events.map(event=>
      event.kind==="utterance.complete"&&event.roleId==="builder"
        ?{...event,message:"This message was changed after the event was sealed."}
        :event
    );

    expect(()=>replayEvents(createInitialState(),tampered))
      .toThrow(/Post-state fingerprint mismatch/);
  });

  it("replays operator mode selection as a ledgered event",()=>{
    const initial=createInitialState();
    const event=buildEvent(initial,{
      source:"operator",
      kind:"mode.selected",
      mode:"build",
      phase:"intake",
      message:"Operator selected BUILD mode."
    });

    const replayed=replayEvents(createInitialState(),[event]);

    expect(replayed.mode).toBe("build");
    expect(replayed.routerPolicy).toBe("build-forward");
    expect(replayed.events).toHaveLength(1);
  });
});
