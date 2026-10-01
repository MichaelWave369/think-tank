import { describe,expect,it } from "vitest";
import { buildEvent,replayEvents } from "../kernel/eventKernel";
import { projectEvent } from "./reducer";
import { createInitialState } from "./state";
import type { ResearchSearchReceipt,ThinkTankState } from "./types";

const addClaim=(state:ThinkTankState)=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"claim.added",
    phase:"intake",
    claim:{id:"CL-1",text:"The claim under research.",addedBy:"operator"},
    message:"claim"
  });
  return {event,state:projectEvent(state,event)};
};

const requestSearch=(state:ThinkTankState,query="claim research")=>{
  const event=buildEvent(state,{
    source:"operator",
    kind:"research.search.requested",
    phase:"intake",
    claimId:"CL-1",
    researchQuery:query,
    message:"search"
  });
  return {event,state:projectEvent(state,event)};
};

const receipt=(query="claim research",uris=["https://example.com/a"]):ResearchSearchReceipt=>({
  id:"RS-0003",
  tool:"searxng-search",
  provider:"searxng",
  claimId:"CL-1",
  query,
  searchedAt:"2026-10-01T17:30:00.000Z",
  resultDigest:"a".repeat(64),
  candidates:uris.map((uri,index)=>({
    id:"RC-0003-"+String(index+1).padStart(2,"0"),
    claimId:"CL-1",
    query,
    title:"Candidate "+(index+1),
    uri,
    snippet:"Candidate snippet "+(index+1),
    engine:"fixture",
    rank:index+1,
    discoveredAt:"2026-10-01T17:30:00.000Z"
  }))
});

const prepared=()=>{
  let state=createInitialState();
  const claim=addClaim(state);state=claim.state;
  const request=requestSearch(state);state=request.state;
  return {state,events:[claim.event,request.event]};
};

describe("governed research kernel",()=>{
  it("replays a quarantined search receipt exactly",()=>{
    const ready=prepared();
    const result=receipt();
    const completed=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"complete"
    });
    const next=projectEvent(ready.state,completed);
    const replayed=replayEvents(createInitialState(),[...ready.events,completed]);

    expect(next.researchSearches).toHaveLength(1);
    expect(next.researchCandidates).toHaveLength(1);
    expect(replayed.researchSearches).toEqual(next.researchSearches);
    expect(replayed.researchCandidates).toEqual(next.researchCandidates);
  });

  it("does not change an existing Reality Gate authorization when candidates are discovered",()=>{
    const ready=prepared();
    ready.state.gateScore=.88;
    ready.state.gateBreakdown={
      provenance:1,
      roleCoverage:1,
      seatDiversity:1,
      challengeCoverage:1,
      externalSupport:.66,
      rawScore:.881,
      finalScore:.88,
      cap:1,
      capReason:"fixture",
      evidenceCount:2,
      verifiedEvidenceCount:1,
      attestedEvidenceCount:1
    };
    ready.state.outputLabel="READY";
    ready.state.actionAllowed=true;

    const result=receipt();
    const completed=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"complete"
    });
    const next=projectEvent(ready.state,completed);

    expect(next.gateScore).toBe(.88);
    expect(next.outputLabel).toBe("READY");
    expect(next.actionAllowed).toBe(true);
    expect(next.evidenceRefs).toHaveLength(0);
  });

  it("requires operator authority to request search",()=>{
    const claim=addClaim(createInitialState()).state;

    expect(()=>buildEvent(claim,{
      source:"system",
      kind:"research.search.requested",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:"query",
      message:"bad"
    })).toThrow(/operator-authorized/i);
  });

  it("rejects completion without a matching request",()=>{
    const claim=addClaim(createInitialState()).state;
    const result=receipt();

    expect(()=>buildEvent(claim,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"bad"
    })).toThrow(/no matching operator request/i);
  });

  it("rejects completion metadata that disagrees with its search receipt",()=>{
    const ready=prepared();
    const result=receipt();

    expect(()=>buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:"different query",
      researchReceipt:result,
      message:"bad"
    })).toThrow(/metadata does not match/i);
  });

  it("rejects duplicate candidate URIs within a receipt",()=>{
    const ready=prepared();
    const result=receipt("claim research",["https://example.com/a","https://example.com/a"]);

    expect(()=>buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"bad"
    })).toThrow(/duplicated for this claim/i);
  });

  it("rejects non-http candidate URIs",()=>{
    const ready=prepared();
    const result=receipt("claim research",["file:///tmp/not-evidence"]);

    expect(()=>buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"bad"
    })).toThrow(/credential-free HTTP\/S/i);
  });

  it("prevents resolving the same search request twice",()=>{
    const ready=prepared();
    const result=receipt();
    const first=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"first"
    });
    const state=projectEvent(ready.state,first);

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:{...result,id:"RS-0004",resultDigest:"b".repeat(64),candidates:[]},
      message:"second"
    })).toThrow(/already resolved/i);
  });

  it("records tool failure without adding candidates",()=>{
    const ready=prepared();
    const failed=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.failed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:"claim research",
      message:"backend unavailable"
    });
    const next=projectEvent(ready.state,failed);

    expect(next.researchCandidates).toHaveLength(0);
    expect(next.researchSearches).toHaveLength(0);
  });

  it("promotes a known candidate only through machine retrieval lineage",()=>{
    const ready=prepared();
    const result=receipt();
    const completed=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"complete"
    });
    const state=projectEvent(ready.state,completed);
    const candidate=state.researchCandidates[0]!;

    const promoted=buildEvent(state,{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      researchCandidateId:candidate.id,
      evidenceUri:candidate.uri,
      evidenceRef:{
        id:"EV-1",
        kind:"external-source",
        verification:"machine-verified",
        label:candidate.title,
        uri:candidate.uri,
        researchCandidateId:candidate.id,
        addedBy:"tool",
        retrieval:{
          tool:"url-fetch",
          requestedUri:candidate.uri,
          finalUri:candidate.uri,
          httpStatus:200,
          contentType:"text/html",
          bytes:100,
          sha256:"c".repeat(64),
          redirects:0,
          retrievedAt:"2026-10-01T17:31:00.000Z"
        }
      },
      message:"promoted"
    });
    const next=projectEvent(state,promoted);

    expect(next.evidenceRefs[0]?.researchCandidateId).toBe(candidate.id);
    expect(next.evidenceRefs[0]?.verification).toBe("machine-verified");
  });

  it("rejects a second promotion of the same candidate",()=>{
    const ready=prepared();
    const result=receipt();
    const completed=buildEvent(ready.state,{
      source:"tool",
      kind:"research.search.completed",
      phase:"intake",
      claimId:"CL-1",
      researchQuery:result.query,
      researchReceipt:result,
      message:"complete"
    });
    let state=projectEvent(ready.state,completed);
    const candidate=state.researchCandidates[0]!;
    state.evidenceRefs=[{
      id:"EV-OLD",
      kind:"external-source",
      verification:"machine-verified",
      label:"Already promoted",
      uri:candidate.uri,
      researchCandidateId:candidate.id,
      addedBy:"tool",
      retrieval:{
        tool:"url-fetch",
        requestedUri:candidate.uri,
        finalUri:candidate.uri,
        httpStatus:200,
        contentType:"text/html",
        bytes:100,
        sha256:"d".repeat(64),
        redirects:0,
        retrievedAt:"2026-10-01T17:31:00.000Z"
      }
    }];

    expect(()=>buildEvent(state,{
      source:"tool",
      kind:"evidence.added",
      phase:"intake",
      researchCandidateId:candidate.id,
      evidenceUri:candidate.uri,
      evidenceRef:{
        id:"EV-NEW",
        kind:"external-source",
        verification:"machine-verified",
        label:"Duplicate promotion",
        uri:candidate.uri,
        researchCandidateId:candidate.id,
        addedBy:"tool",
        retrieval:{
          tool:"url-fetch",
          requestedUri:candidate.uri,
          finalUri:candidate.uri,
          httpStatus:200,
          contentType:"text/html",
          bytes:100,
          sha256:"e".repeat(64),
          redirects:0,
          retrievedAt:"2026-10-01T17:32:00.000Z"
        }
      },
      message:"bad"
    })).toThrow(/already been promoted/i);
  });

  it("locks search during active governed execution",()=>{
    const claim=addClaim(createInitialState()).state;
    claim.phase="independent";

    expect(()=>buildEvent(claim,{
      source:"operator",
      kind:"research.search.requested",
      phase:"independent",
      claimId:"CL-1",
      researchQuery:"query",
      message:"late"
    })).toThrow(/cannot run during an active governed session/i);
  });
});
