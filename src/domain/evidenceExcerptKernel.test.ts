import { describe,expect,it } from "vitest";
import { claimReviewIsFresh,evaluateClaimCoverage } from "./claimCoverage";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { EvidenceExcerpt,ThinkTankState } from "./types";
import { buildEvent,replayEvents } from "../kernel/eventKernel";

const sourceUri="https://example.com/source";
const sourceSha="a".repeat(64);
const projectionSha="b".repeat(64);
const excerptSha="c".repeat(64);
const excerptText="Exact quote";

const machineState=():ThinkTankState=>{
  const state=createInitialState();
  state.evidenceRefs=[{
    id:"EV-1",
    kind:"external-source",
    verification:"machine-verified",
    label:"Verified source",
    uri:sourceUri,
    addedBy:"tool",
    retrieval:{
      tool:"url-fetch",
      requestedUri:sourceUri,
      finalUri:sourceUri,
      httpStatus:200,
      contentType:"text/html; charset=utf-8",
      bytes:123,
      sha256:sourceSha,
      redirects:0,
      retrievedAt:"2026-10-01T12:00:00.000Z"
    }
  }];
  return state;
};

const request=(state:ThinkTankState)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"evidence.excerpt.requested",
    phase:"intake",
    evidenceId:"EV-1",
    excerptStart:0,
    excerptEnd:excerptText.length,
    message:"request"
  });
  return {event,state:projectEvent(state,event)};
};

const receipt=():EvidenceExcerpt=>({
  id:"EX-1",
  evidenceId:"EV-1",
  tool:"text-projector",
  extractor:"text-projection-v1",
  sourceUri,
  sourceSha256:sourceSha,
  projectionSha256:projectionSha,
  excerptSha256:excerptSha,
  contentType:"text/html; charset=utf-8",
  startChar:0,
  endChar:excerptText.length,
  text:excerptText,
  extractedAt:"2026-10-01T12:01:00.000Z",
  addedBy:"tool"
});

const add=(state:ThinkTankState,excerpt=receipt())=>{
  const event=buildEvent(state,{
    source:"tool",
    kind:"evidence.excerpt.added",
    phase:"intake",
    evidenceId:"EV-1",
    excerptStart:excerpt.startChar,
    excerptEnd:excerpt.endChar,
    evidenceExcerpt:excerpt,
    message:"add"
  });
  return {event,state:projectEvent(state,event)};
};

describe("verified source excerpt kernel",()=>{
  it("replays an exact excerpt request and tool receipt",()=>{
    const initial=machineState();
    const requested=request(initial);
    const added=add(requested.state);
    const replayed=replayEvents(initial,[requested.event,added.event]);

    expect(added.state.evidenceExcerpts).toEqual([receipt()]);
    expect(replayed.evidenceExcerpts).toEqual(added.state.evidenceExcerpts);
  });

  it("requires machine-verified evidence before requesting an excerpt",()=>{
    const state=createInitialState();
    state.evidenceRefs=[{
      id:"EV-1",
      kind:"operator-reference",
      verification:"operator-attested",
      label:"Attested only",
      uri:sourceUri,
      addedBy:"operator"
    }];

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.excerpt.requested",
      phase:"intake",
      evidenceId:"EV-1",
      excerptStart:0,
      excerptEnd:5,
      message:"bad"
    })).toThrow(/machine-verified evidence/i);
  });

  it("rejects excerpt ranges larger than the hard kernel cap",()=>{
    const state=machineState();

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.excerpt.requested",
      phase:"intake",
      evidenceId:"EV-1",
      excerptStart:0,
      excerptEnd:1601,
      message:"too large"
    })).toThrow(/exceeds 1600/i);
  });

  it("rejects forged source provenance",()=>{
    const requested=request(machineState());
    const forged={...receipt(),sourceSha256:"d".repeat(64)};

    expect(()=>add(requested.state,forged)).toThrow(/source provenance does not match/i);
  });

  it("rejects content type that disagrees with the verified receipt",()=>{
    const requested=request(machineState());
    const forged={...receipt(),contentType:"text/plain"};

    expect(()=>add(requested.state,forged)).toThrow(/content type does not match/i);
  });

  it("requires the governed tool to add verified excerpts",()=>{
    const requested=request(machineState());
    const excerpt=receipt();

    expect(()=>buildEvent(requested.state,{
      source:"operator",
      kind:"evidence.excerpt.added",
      phase:"intake",
      evidenceId:"EV-1",
      excerptStart:0,
      excerptEnd:excerptText.length,
      evidenceExcerpt:excerpt,
      message:"forged"
    })).toThrow(/tool-originated/i);
  });

  it("allows only one terminal result per excerpt request",()=>{
    const requested=request(machineState());
    const added=add(requested.state);

    expect(()=>buildEvent(added.state,{
      source:"tool",
      kind:"evidence.excerpt.failed",
      phase:"intake",
      evidenceId:"EV-1",
      excerptStart:0,
      excerptEnd:excerptText.length,
      message:"late failure"
    })).toThrow(/already resolved/i);
  });

  it("prevents deleting evidence while excerpts still depend on it",()=>{
    const requested=request(machineState());
    const added=add(requested.state);

    expect(()=>buildEvent(added.state,{
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId:"EV-1",
      message:"remove"
    })).toThrow(/excerpt receipts still exist/i);
  });

  it("allows explicit excerpt removal followed by evidence removal",()=>{
    const requested=request(machineState());
    const added=add(requested.state);

    const removeExcerpt=buildEvent(added.state,{
      source:"operator",
      kind:"evidence.excerpt.removed",
      phase:"intake",
      evidenceExcerptId:"EX-1",
      message:"remove excerpt"
    });
    const withoutExcerpt=projectEvent(added.state,removeExcerpt);

    const removeEvidence=buildEvent(withoutExcerpt,{
      source:"operator",
      kind:"evidence.removed",
      phase:"intake",
      evidenceId:"EV-1",
      message:"remove evidence"
    });
    const final=projectEvent(withoutExcerpt,removeEvidence);

    expect(final.evidenceExcerpts).toHaveLength(0);
    expect(final.evidenceRefs).toHaveLength(0);
  });

  it("makes a bound claim audit stale after an excerpt is pinned",()=>{
    const initial=machineState();
    initial.claims=[{id:"CL-1",text:"Claim under review.",addedBy:"operator"}];
    initial.claimBindings=[{
      id:"CB-1",
      claimId:"CL-1",
      evidenceId:"EV-1",
      relation:"supports",
      addedBy:"operator"
    }];
    const review=evaluateClaimCoverage(initial,"CL-1","CR-1","2026-10-01T12:00:30.000Z");
    initial.claimReviews=[review];
    expect(claimReviewIsFresh(initial,review)).toBe(true);

    const requested=request(initial);
    const added=add(requested.state);

    expect(claimReviewIsFresh(added.state,review)).toBe(false);
    expect(added.state.gateScore).toBeNull();
    expect(added.state.actionAllowed).toBe(false);
  });

  it("locks excerpt mutation during active governed execution",()=>{
    const state=machineState();
    state.phase="independent";

    expect(()=>buildEvent(state,{
      source:"operator",
      kind:"evidence.excerpt.requested",
      phase:"independent",
      evidenceId:"EV-1",
      excerptStart:0,
      excerptEnd:5,
      message:"late"
    })).toThrow(/cannot mutate during an active governed session/i);
  });
});
