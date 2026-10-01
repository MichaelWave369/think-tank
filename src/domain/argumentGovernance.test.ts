import { describe,expect,it } from "vitest";
import { argumentReviewBasisFingerprint } from "./argumentReview";
import { evaluateArgumentGovernance } from "./argumentGovernance";
import { createInitialState } from "./state";
import type { ArgumentReview,ThinkTankState } from "./types";

const withExcerptBasis=()=>{
  const state=createInitialState();
  state.claims=[
    {id:"CL-1",text:"Excerpt-bearing claim.",addedBy:"operator"},
    {id:"CL-2",text:"Claim without excerpts.",addedBy:"operator"}
  ];
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

const reviewFor=(
  state:ThinkTankState,
  status:ArgumentReview["status"],
  id="AR-1"
):ArgumentReview=>({
  id,
  claimId:"CL-1",
  roleId:"challenger",
  seatId:"openai",
  providerModel:"test-model",
  providerRequestId:"req-1",
  createdAt:"2026-10-01T12:02:00.000Z",
  basisFingerprint:argumentReviewBasisFingerprint(state,"CL-1")!,
  points:[{
    excerptId:"EX-1",
    premise:"The excerpt contributes a premise.",
    inference:"The premise bears on the claim.",
    objection:"The excerpt does not establish every surrounding assumption."
  }],
  unresolvedGaps:[],
  summary:"Structured argument review.",
  status
});

describe("argument-map governance",()=>{
  it("keeps SOLO / TRIO / DREAM / BUILD informational",()=>{
    const state=withExcerptBasis();

    for(const mode of ["solo","trio","dream","build"] as const){
      const report=evaluateArgumentGovernance(state,mode);
      expect(report.passed).toBe(true);
      expect(report.policy).toBe("informational");
      expect(report.applicableClaimIds).toEqual(["CL-1"]);
    }
  });

  it("requires a fresh accepted map in COUNCIL / DEBATE / AUDIT",()=>{
    const state=withExcerptBasis();

    for(const mode of ["council","debate","audit"] as const){
      const report=evaluateArgumentGovernance(state,mode);
      expect(report.passed).toBe(false);
      expect(report.missingAcceptedClaimIds).toEqual(["CL-1"]);
    }

    state.argumentReviews=[reviewFor(state,"accepted")];

    for(const mode of ["council","debate","audit"] as const){
      const report=evaluateArgumentGovernance(state,mode);
      expect(report.passed).toBe(true);
      expect(report.freshAcceptedClaimIds).toEqual(["CL-1"]);
    }
  });

  it("applies only to claims with pinned excerpts on bound evidence",()=>{
    const state=withExcerptBasis();
    const report=evaluateArgumentGovernance(state,"council");

    expect(report.applicableClaimIds).toEqual(["CL-1"]);
    expect(report.applicableClaimIds).not.toContain("CL-2");
  });

  it("distinguishes a fresh DRAFT from a missing map",()=>{
    const state=withExcerptBasis();
    state.argumentReviews=[reviewFor(state,"draft")];

    const report=evaluateArgumentGovernance(state,"council");

    expect(report.passed).toBe(false);
    expect(report.draftOnlyClaimIds).toEqual(["CL-1"]);
    expect(report.missingAcceptedClaimIds).toEqual([]);
  });

  it("distinguishes a stale accepted map",()=>{
    const state=withExcerptBasis();
    state.argumentReviews=[reviewFor(state,"accepted")];

    state.claimBindings[0]={...state.claimBindings[0]!,relation:"contradicts"};

    const report=evaluateArgumentGovernance(state,"audit");

    expect(report.passed).toBe(false);
    expect(report.staleAcceptedClaimIds).toEqual(["CL-1"]);
    expect(report.freshAcceptedClaimIds).toEqual([]);
  });

  it("ignores dismissed reviews",()=>{
    const state=withExcerptBasis();
    state.argumentReviews=[reviewFor(state,"dismissed")];

    const report=evaluateArgumentGovernance(state,"council");

    expect(report.passed).toBe(false);
    expect(report.missingAcceptedClaimIds).toEqual(["CL-1"]);
  });

  it("passes strict modes when no claim has an excerpt basis",()=>{
    const state=createInitialState();
    state.claims=[{id:"CL-1",text:"No excerpt basis.",addedBy:"operator"}];

    for(const mode of ["council","debate","audit"] as const){
      const report=evaluateArgumentGovernance(state,mode);
      expect(report.passed).toBe(true);
      expect(report.applicableClaimIds).toEqual([]);
    }
  });

  it("accepts any fresh accepted review even when older accepted history is stale",()=>{
    const state=withExcerptBasis();
    const old=reviewFor(state,"accepted","AR-OLD");

    state.claimBindings[0]={...state.claimBindings[0]!,relation:"contradicts"};
    const current=reviewFor(state,"accepted","AR-NEW");
    state.argumentReviews=[old,current];

    const report=evaluateArgumentGovernance(state,"council");

    expect(report.passed).toBe(true);
    expect(report.freshAcceptedClaimIds).toEqual(["CL-1"]);
    expect(report.staleAcceptedClaimIds).toEqual([]);
  });
});
