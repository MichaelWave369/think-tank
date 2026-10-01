import { describe,expect,it } from "vitest";
import { claimGraphSummary,claimStatusFromBindings } from "./claims";
import { createInitialState } from "./state";
import type { ClaimBinding } from "./types";

const binding=(relation:ClaimBinding["relation"],id:string=relation):ClaimBinding=>({
  id:"CB-"+id,
  claimId:"CL-1",
  evidenceId:"EV-"+id,
  relation,
  addedBy:"operator"
});

describe("claim status derivation",()=>{
  it("marks claims with no bindings as unbound",()=>{
    expect(claimStatusFromBindings([])).toBe("unbound");
  });

  it("derives supported from supporting evidence",()=>{
    expect(claimStatusFromBindings([binding("supports")])).toBe("supported");
  });

  it("derives challenged from contradicting evidence",()=>{
    expect(claimStatusFromBindings([binding("contradicts")])).toBe("challenged");
  });

  it("derives contested when support and contradiction coexist",()=>{
    expect(claimStatusFromBindings([
      binding("supports","S"),
      binding("contradicts","C")
    ])).toBe("contested");
  });

  it("derives context-only when no directional evidence exists",()=>{
    expect(claimStatusFromBindings([binding("context")])).toBe("context-only");
  });

  it("summarizes the graph without assigning truth",()=>{
    const state=createInitialState();
    state.claims=[
      {id:"CL-1",text:"First claim",addedBy:"operator"},
      {id:"CL-2",text:"Second claim",addedBy:"operator"}
    ];
    state.claimBindings=[
      binding("supports","S"),
      {...binding("contradicts","C"),claimId:"CL-1"}
    ];

    expect(claimGraphSummary(state)).toEqual({
      total:2,
      unbound:1,
      supported:0,
      challenged:0,
      contested:1,
      contextOnly:0,
      bindings:2
    });
  });
});
