import { describe,expect,it } from "vitest";
import { buildEvent,replayEvents } from "../kernel/eventKernel";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { ThinkTankState } from "./types";

const addClaim=(state:ThinkTankState,id="CL-1",text="The system has a governed claim graph.")=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"claim.added",
    phase:"intake",
    claim:{id,text,addedBy:"operator"},
    message:"claim"
  });
  return {event,state:projectEvent(state,event)};
};

const addEvidence=(state:ThinkTankState,id="EV-1")=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"evidence.added",
    phase:"intake",
    evidenceRef:{
      id,
      kind:"operator-reference",
      verification:"operator-attested",
      label:"Fixture evidence",
      addedBy:"operator"
    },
    message:"evidence"
  });
  return {event,state:projectEvent(state,event)};
};

const bind=(state:ThinkTankState,id="CB-1",relation:"supports"|"contradicts"|"context"="supports")=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"evidence.bound",
    phase:"intake",
    claimBinding:{
      id,
      claimId:"CL-1",
      evidenceId:"EV-1",
      relation,
      addedBy:"operator"
    },
    message:"bind"
  });
  return {event,state:projectEvent(state,event)};
};

const prepared=()=>{
  let state=createInitialState();
  const claim=addClaim(state);state=claim.state;
  const evidence=addEvidence(state);state=evidence.state;
  return {state,events:[claim.event,evidence.event]};
};

describe("claim graph kernel",()=>{
  it("replays claim creation and binding exactly",()=>{
    const preparedState=prepared();
    const bound=bind(preparedState.state);
    const events=[...preparedState.events,bound.event];
    const replayed=replayEvents(createInitialState(),events);

    expect(replayed.claims).toHaveLength(1);
    expect(replayed.claimBindings).toHaveLength(1);
    expect(replayed.claimBindings[0]?.relation).toBe("supports");
  });

  it("rejects duplicate equivalent claims",()=>{
    const first=addClaim(createInitialState()).state;

    expect(()=>buildEvent(first,{
      source:"operator",
      kind:"claim.added",
      phase:"intake",
      claim:{id:"CL-2",text:"  THE SYSTEM HAS A GOVERNED CLAIM GRAPH.  ",addedBy:"operator"},
      message:"duplicate"
    })).toThrow(/equivalent claim already exists/i);
  });

  it("rejects bindings to unknown claims",()=>{
    const evidence=addEvidence(createInitialState()).state;

    expect(()=>buildEvent(evidence,{
      source:"operator",
      kind:"evidence.bound",
      phase:"intake",
      claimBinding:{
        id:"CB-X",
        claimId:"CL-MISSING",
        evidenceId:"EV-1",
        relation:"supports",
        addedBy:"operator"
      },
      message:"bad"
    })).toThrow(/unknown claim/i);
  });

  it("rejects bindings to unknown evidence",()=>{
    const claim=addClaim(createInitialState()).state;

    expect(()=>buildEvent(claim,{
      source:"operator",
      kind:"evidence.bound",
      phase:"intake",
      claimBinding:{
        id:"CB-X",
        claimId:"CL-1",
        evidenceId:"EV-MISSING",
        relation:"supports",
        addedBy:"operator"
      },
      message:"bad"
    })).toThrow(/unknown evidence/i);
  });

  it("requires unbind before changing relation for the same claim/source pair",()=>{
    const ready=prepared();
    const first=bind(ready.state);
    const state=first.state;

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.bound",
      phase:"intake",
      claimBinding:{
        id:"CB-2",
        claimId:"CL-1",
        evidenceId:"EV-1",
        relation:"contradicts",
        addedBy:"operator"
      },
      message:"change"
    })).toThrow(/unbind before changing relation/i);
  });

  it("prevents removing a claim while bindings exist",()=>{
    const ready=prepared();
    const state=bind(ready.state).state;

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"claim.removed",
      phase:"intake",
      claimId:"CL-1",
      message:"remove"
    })).toThrow(/bindings still exist/i);
  });

  it("prevents removing evidence while bindings exist",()=>{
    const ready=prepared();
    const state=bind(ready.state).state;

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId:"EV-1",
      message:"remove"
    })).toThrow(/claim bindings still exist/i);
  });

  it("allows explicit unbind followed by evidence removal",()=>{
    const ready=prepared();
    let state=bind(ready.state).state;

    const unbind=buildEvent(state,{
      source:"operator",
      kind:"evidence.unbound",
      phase:"intake",
      claimBindingId:"CB-1",
      message:"unbind"
    });
    state=projectEvent(state,unbind);

    const remove=buildEvent(state,{
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId:"EV-1",
      message:"remove"
    });
    state=projectEvent(state,remove);

    expect(state.claimBindings).toHaveLength(0);
    expect(state.evidenceRefs).toHaveLength(0);
  });

  it("rejects claim graph mutation during active execution",()=>{
    const state=createInitialState();
    state.phase="independent";

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"claim.added",
      phase:"independent",
      claim:{id:"CL-LATE",text:"Late claim",addedBy:"operator"},
      message:"late"
    })).toThrow(/cannot mutate during an active governed session/i);
  });

  it("invalidates prior gate authorization when the claim graph changes",()=>{
    const state=createInitialState();
    state.gateScore=.9;
    state.gateBreakdown={
      provenance:1,roleCoverage:1,seatDiversity:1,challengeCoverage:1,
      externalSupport:.75,rawScore:.9125,finalScore:.9,cap:1,
      capReason:"fixture",evidenceCount:2,verifiedEvidenceCount:1,attestedEvidenceCount:1
    };
    state.outputLabel="READY";
    state.actionAllowed=true;

    const event=buildEvent(state,{
      source:"operator",
      kind:"claim.added",
      phase:"intake",
      claim:{id:"CL-1",text:"A new interpretation exists.",addedBy:"operator"},
      message:"claim"
    });
    const next=projectEvent(state,event);

    expect(next.gateScore).toBeNull();
    expect(next.gateBreakdown).toBeNull();
    expect(next.outputLabel).toBeNull();
    expect(next.actionAllowed).toBe(false);
    expect(next.governanceReason).toMatch(/claim graph changed/i);
  });
});
