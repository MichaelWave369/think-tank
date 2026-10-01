import { describe,expect,it } from "vitest";
import { evaluateClaimCoverage,claimReviewIsFresh } from "./claimCoverage";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import { buildEvent,replayEvents } from "../kernel/eventKernel";
import type { ThinkTankState } from "./types";

const addClaim=(state:ThinkTankState)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"claim.added",
    phase:"intake",
    claim:{id:"CL-1",text:"A reviewable claim.",addedBy:"operator"},
    message:"claim"
  });
  return {event,state:projectEvent(state,event)};
};

const request=(state:ThinkTankState)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"claim.review.requested",
    phase:"intake",
    roleId:"challenger",
    claimId:"CL-1",
    message:"review"
  });
  return {event,state:projectEvent(state,event)};
};

const complete=(state:ThinkTankState,id="CR-1")=>{
  const review=evaluateClaimCoverage(state,"CL-1",id,"2026-10-01T12:00:00.000Z");
  const event=buildEvent(state,{
    source:"system",
    kind:"claim.review.completed",
    phase:"intake",
    roleId:"challenger",
    claimId:"CL-1",
    claimReview:review,
    message:"complete"
  });
  return {event,state:projectEvent(state,event),review};
};

const prepared=()=>{
  let state=createInitialState();
  const claim=addClaim(state);state=claim.state;
  const requested=request(state);state=requested.state;
  return {state,events:[claim.event,requested.event]};
};

describe("Challenger claim review kernel",()=>{
  it("replays a deterministic review receipt exactly",()=>{
    const ready=prepared();
    const done=complete(ready.state);
    const replayed=replayEvents(createInitialState(),[...ready.events,done.event]);

    expect(done.state.claimReviews).toHaveLength(1);
    expect(replayed.claimReviews).toEqual(done.state.claimReviews);
    expect(replayed.claimReviews[0]?.basisFingerprint).toBe(done.review.basisFingerprint);
  });

  it("requires operator authority for review requests",()=>{
    const claim=addClaim(createInitialState()).state;

    expect(()=>buildEvent(claim,{
      source:"system",
      kind:"claim.review.requested",
      phase:"intake",
      roleId:"challenger",
      claimId:"CL-1",
      message:"bad"
    })).toThrow(/operator-authorized/i);
  });

  it("requires Challenger scope",()=>{
    const claim=addClaim(createInitialState()).state;

    expect(()=>buildEvent(claim,{
      source:"operator",
      kind:"claim.review.requested",
      phase:"intake",
      roleId:"builder",
      claimId:"CL-1",
      message:"bad"
    })).toThrow(/scoped to Challenger/i);
  });

  it("rejects completion without a matching request",()=>{
    const claim=addClaim(createInitialState()).state;
    const review=evaluateClaimCoverage(claim,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(()=>buildEvent(claim,{
      source:"system",
      kind:"claim.review.completed",
      phase:"intake",
      roleId:"challenger",
      claimId:"CL-1",
      claimReview:review,
      message:"bad"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects a forged review receipt",()=>{
    const ready=prepared();
    const review=evaluateClaimCoverage(ready.state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");
    review.machineVerifiedCount=99;

    expect(()=>buildEvent(ready.state,{
      source:"system",
      kind:"claim.review.completed",
      phase:"intake",
      roleId:"challenger",
      claimId:"CL-1",
      claimReview:review,
      message:"forged"
    })).toThrow(/deterministic recomputation/i);
  });

  it("rejects graph mutation between request and completion",()=>{
    const ready=prepared();
    const evidence=buildEvent(ready.state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-1",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Late evidence",
        addedBy:"operator"
      },
      message:"late"
    });
    const changed=projectEvent(ready.state,evidence);
    const review=evaluateClaimCoverage(changed,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(()=>buildEvent(changed,{
      source:"system",
      kind:"claim.review.completed",
      phase:"intake",
      roleId:"challenger",
      claimId:"CL-1",
      claimReview:review,
      message:"stale request"
    })).toThrow(/graph changed after review request/i);
  });

  it("does not alter an existing Reality Gate authorization",()=>{
    const ready=prepared();
    ready.state.gateScore=.88;
    ready.state.outputLabel="READY";
    ready.state.actionAllowed=true;
    const done=complete(ready.state);

    expect(done.state.gateScore).toBe(.88);
    expect(done.state.outputLabel).toBe("READY");
    expect(done.state.actionAllowed).toBe(true);
  });

  it("becomes stale only after later graph mutation",()=>{
    const ready=prepared();
    const done=complete(ready.state);
    expect(claimReviewIsFresh(done.state,done.review)).toBe(true);

    const evidence=buildEvent(done.state,{
      source:"operator",
      kind:"evidence.added",
      phase:"intake",
      evidenceRef:{
        id:"EV-1",
        kind:"operator-reference",
        verification:"operator-attested",
        label:"Later evidence",
        addedBy:"operator"
      },
      message:"later"
    });
    let changed=projectEvent(done.state,evidence);

    const binding=buildEvent(changed,{
      source:"operator",
      kind:"evidence.bound",
      phase:"intake",
      claimBinding:{
        id:"CB-1",
        claimId:"CL-1",
        evidenceId:"EV-1",
        relation:"supports",
        addedBy:"operator"
      },
      message:"bind"
    });
    changed=projectEvent(changed,binding);

    expect(claimReviewIsFresh(changed,done.review)).toBe(false);
  });

  it("locks review during active governed execution",()=>{
    const claim=addClaim(createInitialState()).state;
    claim.phase="independent";

    expect(()=>buildEvent(claim,{
      source:"operator",
      kind:"claim.review.requested",
      phase:"independent",
      roleId:"challenger",
      claimId:"CL-1",
      message:"late"
    })).toThrow(/cannot run during an active governed session/i);
  });
});
