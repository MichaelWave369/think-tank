import { describe,expect,it } from "vitest";
import {
  argumentReviewBasisFingerprint,
  argumentReviewEligibility,
  argumentReviewIsFresh
} from "./argumentReview";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { ArgumentReview,ThinkTankState } from "./types";
import { buildEvent,replayEvents } from "../kernel/eventKernel";

const baseState=()=>{
  const state=createInitialState();
  state.claims=[{id:"CL-1",text:"The source supports a provenance claim.",addedBy:"operator"}];
  state.evidenceRefs=[{
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
  state.claimBindings=[{
    id:"CB-1",
    claimId:"CL-1",
    evidenceId:"EV-1",
    relation:"supports",
    addedBy:"operator"
  }];
  state.evidenceExcerpts=[{
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
  return state;
};

const request=(state:ThinkTankState)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"argument.review.requested",
    phase:"intake",
    roleId:"challenger",
    seatId:"openai",
    claimId:"CL-1",
    message:"request"
  });
  return {event,state:projectEvent(state,event)};
};

const reviewFor=(state:ThinkTankState,overrides:Partial<ArgumentReview>={}):ArgumentReview=>({
  id:"AR-1",
  claimId:"CL-1",
  roleId:"challenger",
  seatId:"openai",
  providerModel:"test-model",
  providerRequestId:"req-1",
  createdAt:"2026-10-01T12:02:00.000Z",
  basisFingerprint:argumentReviewBasisFingerprint(state,"CL-1")!,
  points:[{
    excerptId:"EX-1",
    premise:"The excerpt contributes a provenance premise.",
    inference:"The premise can support the registered claim if its stated mechanism applies.",
    objection:"The excerpt alone does not independently establish the broader system behavior."
  }],
  unresolvedGaps:["Independent implementation verification remains outside this excerpt."],
  summary:"The excerpt bears on the claim but does not close every inference.",
  status:"draft",
  ...overrides
});

const complete=(state:ThinkTankState,review=reviewFor(state))=>{
  const event=buildEvent(state,{
    source:"provider",
    kind:"argument.review.completed",
    phase:"intake",
    roleId:"challenger",
    seatId:"openai",
    claimId:"CL-1",
    providerModel:review.providerModel,
    providerRequestId:review.providerRequestId,
    argumentReview:review,
    message:"complete"
  });
  return {event,state:projectEvent(state,event),review};
};

describe("excerpt-aware argument review kernel",()=>{
  it("replays a provider DRAFT exactly",()=>{
    const initial=baseState();
    const requested=request(initial);
    const completed=complete(requested.state);
    const replayed=replayEvents(initial,[requested.event,completed.event]);

    expect(replayed.argumentReviews).toEqual(completed.state.argumentReviews);
    expect(replayed.argumentReviews[0]?.status).toBe("draft");
  });

  it("requires at least one bound pinned excerpt",()=>{
    const state=baseState();
    state.evidenceExcerpts=[];

    expect(argumentReviewEligibility(state,"CL-1").allowed).toBe(false);
    expect(()=>request(state)).toThrow(/Pin at least one exact excerpt/i);
  });

  it("requires the current Challenger seat",()=>{
    const state=baseState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"argument.review.requested",
      phase:"intake",
      roleId:"challenger",
      seatId:"kimi",
      claimId:"CL-1",
      message:"wrong seat"
    })).toThrow(/currently assigned Challenger seat/i);
  });

  it("rejects a forged basis fingerprint",()=>{
    const requested=request(baseState());
    const forged=reviewFor(requested.state,{basisFingerprint:"fnv1a32:deadbeef"});

    expect(()=>complete(requested.state,forged)).toThrow(/basis fingerprint/i);
  });

  it("rejects an unknown excerpt citation",()=>{
    const requested=request(baseState());
    const forged=reviewFor(requested.state,{
      points:[{excerptId:"EX-999",premise:"p",inference:"i",objection:"o"}]
    });

    expect(()=>complete(requested.state,forged)).toThrow(/excerpt references are invalid/i);
  });

  it("rejects omitted excerpt coverage",()=>{
    const state=baseState();
    state.evidenceExcerpts.push({
      ...state.evidenceExcerpts[0]!,
      id:"EX-2",
      excerptSha256:"d".repeat(64),
      startChar:20,
      endChar:32,
      text:"Second quote"
    });
    const requested=request(state);
    const forged=reviewFor(requested.state,{
      basisFingerprint:argumentReviewBasisFingerprint(requested.state,"CL-1")!,
      points:[{excerptId:"EX-1",premise:"p",inference:"i",objection:"o"}]
    });

    expect(()=>complete(requested.state,forged)).toThrow(/every eligible excerpt exactly once/i);
  });

  it("rejects completion after the basis changes",()=>{
    const requested=request(baseState());
    const changed={...requested.state,claimBindings:[
      {...requested.state.claimBindings[0]!,relation:"contradicts" as const}
    ]};
    const review=reviewFor(requested.state);

    expect(()=>complete(changed,review)).toThrow(/basis fingerprint|basis changed/i);
  });

  it("accepts a DRAFT only through operator authority",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);

    const acceptedEvent=buildEvent(completed.state,{
      source:"operator",
      kind:"argument.review.accepted",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"accept"
    });
    const accepted=projectEvent(completed.state,acceptedEvent);

    expect(accepted.argumentReviews[0]?.status).toBe("accepted");
    expect(()=>buildEvent(accepted,{
      source:"operator",
      kind:"argument.review.accepted",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"accept again"
    })).toThrow(/Only an existing DRAFT/i);
  });

  it("allows an accepted review to be dismissed",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);
    const accepted=projectEvent(completed.state,buildEvent(completed.state,{
      source:"operator",
      kind:"argument.review.accepted",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"accept"
    }));

    const dismissed=projectEvent(accepted,buildEvent(accepted,{
      source:"operator",
      kind:"argument.review.dismissed",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"dismiss"
    }));

    expect(dismissed.argumentReviews[0]?.status).toBe("dismissed");
  });

  it("blocks cited excerpt deletion until the review is dismissed",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);

    expect(()=>buildEvent(completed.state,{
      source:"operator",
      kind:"evidence.excerpt.removed",
      phase:"intake",
      evidenceExcerptId:"EX-1",
      message:"remove"
    })).toThrow(/active argument reviews still cite it/i);

    const dismissed=projectEvent(completed.state,buildEvent(completed.state,{
      source:"operator",
      kind:"argument.review.dismissed",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"dismiss"
    }));

    expect(()=>buildEvent(dismissed,{
      source:"operator",
      kind:"evidence.excerpt.removed",
      phase:"intake",
      evidenceExcerptId:"EX-1",
      message:"remove"
    })).not.toThrow();
  });

  it("blocks claim deletion while a non-dismissed argument review remains",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);

    const unbound=projectEvent(completed.state,buildEvent(completed.state,{
      source:"operator",
      kind:"evidence.unbound",
      phase:"intake",
      claimBindingId:"CB-1",
      message:"unbind"
    }));

    expect(()=>buildEvent(unbound,{
      source:"operator",
      kind:"claim.removed",
      phase:"intake",
      claimId:"CL-1",
      message:"remove"
    })).toThrow(/active argument reviews still exist/i);
  });

  it("marks a review stale when the canonical argument basis changes",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);
    const review=completed.state.argumentReviews[0]!;
    expect(argumentReviewIsFresh(completed.state,review)).toBe(true);

    const unbound=projectEvent(completed.state,buildEvent(completed.state,{
      source:"operator",
      kind:"evidence.unbound",
      phase:"intake",
      claimBindingId:"CB-1",
      message:"unbind"
    }));

    expect(argumentReviewIsFresh(unbound,review)).toBe(false);
  });

  it("acceptance is observational and does not rewrite Gate authorization",()=>{
    const requested=request(baseState());
    const completed=complete(requested.state);
    completed.state.gateScore=.88;
    completed.state.actionAllowed=true;

    const accepted=projectEvent(completed.state,buildEvent(completed.state,{
      source:"operator",
      kind:"argument.review.accepted",
      phase:"intake",
      argumentReviewId:"AR-1",
      message:"accept"
    }));

    expect(accepted.gateScore).toBe(.88);
    expect(accepted.actionAllowed).toBe(true);
  });

  it("locks argument review during active governed execution",()=>{
    const state=baseState();
    state.phase="independent";

    expect(()=>request(state)).toThrow(/cannot run during an active governed session/i);
  });
});
