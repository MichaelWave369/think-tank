import { describe,expect,it } from "vitest";
import { evaluateClaimGovernance } from "./claimGovernance";
import { evaluateClaimCoverage } from "./claimCoverage";
import { createInitialState } from "./state";
import type { ClaimBinding,EvidenceRef,ThinkTankState } from "./types";

const stateWithClaim=()=>{
  const state=createInitialState();
  state.claims=[{id:"CL-1",text:"Policy claim.",addedBy:"operator"}];
  return state;
};

const attested=(id="EV-1"):EvidenceRef=>({
  id,
  kind:"operator-reference",
  verification:"operator-attested",
  label:id,
  uri:"https://example.com/"+id.toLowerCase(),
  addedBy:"operator"
});

const bind=(relation:ClaimBinding["relation"]="supports"):ClaimBinding=>({
  id:"CB-1",
  claimId:"CL-1",
  evidenceId:"EV-1",
  relation,
  addedBy:"operator"
});

const addFreshReview=(state:ThinkTankState,id="CR-1")=>{
  state.claimReviews.push(
    evaluateClaimCoverage(state,"CL-1",id,"2026-10-01T12:00:00.000Z")
  );
};

describe("claim-aware governance policy",()=>{
  it("keeps SOLO and DREAM informational even with unreviewed claims",()=>{
    const state=stateWithClaim();

    expect(evaluateClaimGovernance(state,"solo").passed).toBe(true);
    expect(evaluateClaimGovernance(state,"dream").passed).toBe(true);
  });

  it("requires fresh review only for bound claims in TRIO / DEBATE / BUILD",()=>{
    const state=stateWithClaim();

    expect(evaluateClaimGovernance(state,"trio").passed).toBe(true);

    state.evidenceRefs=[attested()];
    state.claimBindings=[bind()];

    const blocked=evaluateClaimGovernance(state,"trio");
    expect(blocked.passed).toBe(false);
    expect(blocked.missingReviewClaimIds).toEqual(["CL-1"]);

    addFreshReview(state);

    expect(evaluateClaimGovernance(state,"trio").passed).toBe(true);
    expect(evaluateClaimGovernance(state,"debate").passed).toBe(true);
    expect(evaluateClaimGovernance(state,"build").passed).toBe(true);
  });

  it("requires every registered claim to have a fresh review in COUNCIL",()=>{
    const state=stateWithClaim();

    expect(evaluateClaimGovernance(state,"council").passed).toBe(false);

    addFreshReview(state);

    const report=evaluateClaimGovernance(state,"council");
    expect(report.passed).toBe(true);
    expect(report.freshClaimIds).toEqual(["CL-1"]);
  });

  it("blocks stale review receipts",()=>{
    const state=stateWithClaim();
    state.evidenceRefs=[attested()];
    state.claimBindings=[bind()];
    addFreshReview(state);

    expect(evaluateClaimGovernance(state,"council").passed).toBe(true);

    state.claimBindings[0]={...state.claimBindings[0],relation:"contradicts"};

    const report=evaluateClaimGovernance(state,"council");
    expect(report.passed).toBe(false);
    expect(report.staleReviewClaimIds).toEqual(["CL-1"]);
  });

  it("AUDIT requires fresh reviews and blocks UNBOUND or THIN coverage",()=>{
    const unbound=stateWithClaim();
    addFreshReview(unbound);

    const unboundReport=evaluateClaimGovernance(unbound,"audit");
    expect(unboundReport.passed).toBe(false);
    expect(unboundReport.coverageBlockedClaimIds).toEqual(["CL-1"]);

    const thin=stateWithClaim();
    thin.evidenceRefs=[attested()];
    thin.claimBindings=[bind()];
    addFreshReview(thin);

    const thinReport=evaluateClaimGovernance(thin,"audit");
    expect(thinReport.passed).toBe(false);
    expect(thinReport.coverageBlockedClaimIds).toEqual(["CL-1"]);
  });

  it("AUDIT accepts a fresh non-thin contested claim",()=>{
    const state=stateWithClaim();
    state.evidenceRefs=[attested("EV-1"),attested("EV-2")];
    state.claimBindings=[
      bind("supports"),
      {
        id:"CB-2",
        claimId:"CL-1",
        evidenceId:"EV-2",
        relation:"contradicts",
        addedBy:"operator"
      }
    ];
    addFreshReview(state);

    const report=evaluateClaimGovernance(state,"audit");
    expect(report.passed).toBe(true);
    expect(report.coverageBlockedClaimIds).toEqual([]);
  });

  it("a mode with no applicable claims passes without manufacturing requirements",()=>{
    const state=createInitialState();
    const report=evaluateClaimGovernance(state,"audit");

    expect(report.passed).toBe(true);
    expect(report.applicableClaimIds).toEqual([]);
  });
});
