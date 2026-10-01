import { describe,expect,it } from "vitest";
import { createInitialState } from "../domain/state";
import { scenarioEventInputs } from "../sim/demo";
import { projectEvent } from "../domain/reducer";
import { demoEventInputs } from "../sim/demo";
import { buildEvent,buildEventBatch,replayEvents,verifyReplay } from "./eventKernel";
import { fingerprintProjection } from "./fingerprint";

describe("event kernel",()=>{
  it("mints a decision dossier and replays it exactly",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(
      initial,
      scenarioEventInputs("Dossier replay test.","council","council-gate-block",initial)
    );
    const finalEvent=events[events.length-1]!;
    const live=events.reduce(projectEvent,initial);
    const replayed=replayEvents(createInitialState(),events);

    expect(finalEvent.decisionDossier?.id).toBe("DOS-"+String(finalEvent.seq).padStart(4,"0"));
    expect(finalEvent.decisionDossier?.outcome).toBe("withheld");
    expect(live.decisionDossiers).toHaveLength(1);
    expect(replayed.decisionDossiers).toEqual(live.decisionDossiers);
  });

  it("rejects a forged synthesis decision dossier",()=>{
    const initial=createInitialState();
    const inputs=scenarioEventInputs(
      "Forge dossier test.","council","council-gate-block",initial
    );
    const prefix=inputs.slice(0,-1);
    const finalInput=inputs[inputs.length-1]!;
    const prefixEvents=buildEventBatch(initial,prefix);
    const state=prefixEvents.reduce(projectEvent,initial);

    const valid=buildEvent(state,finalInput);
    const forged={
      ...finalInput,
      decisionDossier:{
        ...valid.decisionDossier!,
        basisFingerprint:"fnv1a32:deadbeef"
      }
    };

    expect(()=>buildEvent(state,forged)).toThrow(/Decision dossier does not match deterministic recomputation/i);
  });

  it("rejects a replay ledger with the dossier removed",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(
      initial,
      scenarioEventInputs("Missing dossier test.","council","council-gate-block",initial)
    );
    const tampered=events.map((event,index)=>
      index===events.length-1?{...event,decisionDossier:undefined}:event
    );

    expect(()=>replayEvents(createInitialState(),tampered))
      .toThrow(/requires a decision dossier/i);
  });

  it("rejects a synthesis reason that disagrees with deterministic governance",()=>{
    const initial=createInitialState();
    const inputs=scenarioEventInputs(
      "Reason integrity test.","council","council-gate-block",initial
    );
    const prefix=inputs.slice(0,-1);
    const finalInput={...inputs[inputs.length-1]!,governanceReason:"Made-up reason."};
    const state=buildEventBatch(initial,prefix).reduce(projectEvent,initial);

    expect(()=>buildEvent(state,finalInput))
      .toThrow(/Governance reason does not match deterministic/i);
  });

  it("links FORCE SYNTHESIS to the latest withheld dossier and replays exactly",()=>{
    const initial=createInitialState();
    const events=buildEventBatch(
      initial,
      scenarioEventInputs("Override dossier test.","council","council-gate-block",initial)
    );
    const withheld=events.reduce(projectEvent,initial);

    const override=buildEvent(withheld,{
      source:"operator",
      kind:"operator.override",
      phase:"synthesis",
      override:true,
      outputLabel:"STANDARD",
      actionAllowed:true,
      governanceReason:"Human operator explicitly overrode the withheld/faulted synthesis state.",
      message:"Operator override recorded: FORCE SYNTHESIS."
    });
    const final=projectEvent(withheld,override);

    expect(override.decisionOverride?.dossierId).toBe(withheld.decisionDossiers[0]?.id);
    expect(final.decisionOverrides).toHaveLength(1);
    expect(final.decisionDossiers[0]?.outcome).toBe("withheld");

    const replayed=replayEvents(createInitialState(),[...events,override]);
    expect(replayed.decisionOverrides).toEqual(final.decisionOverrides);
    expect(replayed.actionAllowed).toBe(true);
  });

  it("rejects a forged passing argument-governance receipt",()=>{
    const initial=createInitialState();
    initial.claims=[{id:"CL-1",text:"Excerpt-bearing council claim.",addedBy:"operator"}];
    initial.evidenceRefs=[{
      id:"EV-1",
      kind:"external-source",
      verification:"machine-verified",
      label:"Source",
      uri:"https://example.com/source",
      addedBy:"tool",
      retrieval:{
        tool:"url-fetch",
        requestedUri:"https://example.com/source",
        finalUri:"https://example.com/source",
        httpStatus:200,
        contentType:"text/plain",
        bytes:100,
        sha256:"a".repeat(64),
        redirects:0,
        retrievedAt:"2026-10-01T12:00:00.000Z"
      }
    }];
    initial.claimBindings=[{
      id:"CB-1",
      claimId:"CL-1",
      evidenceId:"EV-1",
      relation:"supports",
      addedBy:"operator"
    }];
    initial.evidenceExcerpts=[{
      id:"EX-1",
      evidenceId:"EV-1",
      tool:"text-projector",
      extractor:"text-projection-v1",
      sourceUri:"https://example.com/source",
      sourceSha256:"a".repeat(64),
      projectionSha256:"b".repeat(64),
      excerptSha256:"c".repeat(64),
      contentType:"text/plain",
      startChar:0,
      endChar:11,
      text:"Exact quote",
      extractedAt:"2026-10-01T12:01:00.000Z",
      addedBy:"tool"
    }];

    const inputs=scenarioEventInputs(
      "Test forged argument policy.",
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
      argumentGovernance:{
        ...finalInput.argumentGovernance!,
        passed:true,
        missingAcceptedClaimIds:[],
        staleAcceptedClaimIds:[],
        draftOnlyClaimIds:[],
        reason:"Forged argument pass."
      }
    };

    expect(()=>buildEvent(state,forged)).toThrow(/argument governance receipt does not match/i);
  });
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
