import { describe,expect,it } from "vitest";
import {
  claimCoverageFingerprint,
  claimCoverageSummary,
  claimReviewIsFresh,
  evaluateClaimCoverage
} from "./claimCoverage";
import { createInitialState } from "./state";
import type { ClaimBinding,EvidenceRef,ThinkTankState } from "./types";

const baseState=()=>{
  const state=createInitialState();
  state.claims=[{id:"CL-1",text:"A claim under structural review.",addedBy:"operator"}];
  return state;
};

const evidence=(id:string,verification:EvidenceRef["verification"],research=false):EvidenceRef=>({
  id,
  kind:verification==="machine-verified"?"external-source":"operator-reference",
  verification,
  label:id,
  uri:"https://example.com/"+id.toLowerCase(),
  researchCandidateId:research?"RC-"+id:undefined,
  addedBy:verification==="machine-verified"?"tool":"operator",
  retrieval:verification==="machine-verified"?{
    tool:"url-fetch",
    requestedUri:"https://example.com/"+id.toLowerCase(),
    finalUri:"https://example.com/"+id.toLowerCase(),
    httpStatus:200,
    contentType:"text/html",
    bytes:100,
    sha256:(id.endsWith("1")?"a":"b").repeat(64),
    redirects:0,
    retrievedAt:"2026-10-01T12:00:00.000Z"
  }:undefined
});

const binding=(id:string,evidenceId:string,relation:ClaimBinding["relation"]):ClaimBinding=>({
  id,
  claimId:"CL-1",
  evidenceId,
  relation,
  addedBy:"operator"
});

describe("claim coverage evaluator",()=>{
  it("marks an unbound claim with explicit missing-evidence flags",()=>{
    const review=evaluateClaimCoverage(baseState(),"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(review.coverageState).toBe("unbound");
    expect(review.boundEvidenceCount).toBe(0);
    expect(review.flags).toContain("no-evidence");
    expect(review.flags).toContain("no-machine-verified");
  });

  it("marks one supporting source as thin and one-sided",()=>{
    const state=baseState();
    state.evidenceRefs=[evidence("EV-1","operator-attested")];
    state.claimBindings=[binding("CB-1","EV-1","supports")];

    const review=evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(review.coverageState).toBe("thin");
    expect(review.supportCount).toBe(1);
    expect(review.flags).toEqual(expect.arrayContaining([
      "single-source","no-machine-verified","no-research-lineage","support-only"
    ]));
  });

  it("marks multi-source same-direction evidence as directional",()=>{
    const state=baseState();
    state.evidenceRefs=[
      evidence("EV-1","machine-verified",true),
      evidence("EV-2","operator-attested")
    ];
    state.claimBindings=[
      binding("CB-1","EV-1","supports"),
      binding("CB-2","EV-2","supports")
    ];

    const review=evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(review.coverageState).toBe("directional");
    expect(review.machineVerifiedCount).toBe(1);
    expect(review.operatorAttestedCount).toBe(1);
    expect(review.researchLineageCount).toBe(1);
    expect(review.flags).toContain("support-only");
  });

  it("marks support plus contradiction as contested",()=>{
    const state=baseState();
    state.evidenceRefs=[
      evidence("EV-1","machine-verified",true),
      evidence("EV-2","operator-attested")
    ];
    state.claimBindings=[
      binding("CB-1","EV-1","supports"),
      binding("CB-2","EV-2","contradicts")
    ];

    const review=evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(review.coverageState).toBe("contested");
    expect(review.flags).toContain("mixed-direction");
  });

  it("marks purely contextual evidence as context-only",()=>{
    const state=baseState();
    state.evidenceRefs=[evidence("EV-1","operator-attested")];
    state.claimBindings=[binding("CB-1","EV-1","context")];

    const review=evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");

    expect(review.coverageState).toBe("context-only");
    expect(review.flags).toContain("context-only");
  });

  it("fingerprint changes when the reviewed claim graph changes",()=>{
    const state=baseState();
    const before=claimCoverageFingerprint(state,"CL-1");

    state.evidenceRefs=[evidence("EV-1","operator-attested")];
    state.claimBindings=[binding("CB-1","EV-1","supports")];

    expect(claimCoverageFingerprint(state,"CL-1")).not.toBe(before);
  });

  it("reports a stored audit as stale after graph mutation",()=>{
    const state=baseState();
    const review=evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z");
    state.claimReviews=[review];

    expect(claimReviewIsFresh(state,review)).toBe(true);

    state.evidenceRefs=[evidence("EV-1","operator-attested")];
    state.claimBindings=[binding("CB-1","EV-1","supports")];

    expect(claimReviewIsFresh(state,review)).toBe(false);
    expect(claimCoverageSummary(state)).toEqual({
      reviewed:1,
      stale:1,
      unreviewed:0
    });
  });

  it("keeps review history out of the coverage basis fingerprint",()=>{
    const state:ThinkTankState=baseState();
    const before=claimCoverageFingerprint(state,"CL-1");
    state.claimReviews=[
      evaluateClaimCoverage(state,"CL-1","CR-1","2026-10-01T12:00:00.000Z")
    ];

    expect(claimCoverageFingerprint(state,"CL-1")).toBe(before);
  });
});
