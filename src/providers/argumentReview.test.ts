import { describe,expect,it } from "vitest";
import { createInitialState } from "../domain/state";
import {
  buildArgumentReviewMessages,
  parseArgumentReviewResponse
} from "./argumentReview";

const prepared=()=>{
  const state=createInitialState();
  state.claims=[{id:"CL-1",text:"The system preserves exact provenance.",addedBy:"operator"}];
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
      contentType:"text/html",
      bytes:200,
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
    note:"Operator relation",
    addedBy:"operator"
  }];
  state.evidenceExcerpts=[
    {
      id:"EX-1",
      evidenceId:"EV-1",
      tool:"text-projector",
      extractor:"text-projection-v1",
      sourceUri:"https://example.com/source",
      sourceSha256:"a".repeat(64),
      projectionSha256:"b".repeat(64),
      excerptSha256:"c".repeat(64),
      contentType:"text/html",
      startChar:0,
      endChar:11,
      text:"Exact alpha",
      extractedAt:"2026-10-01T12:01:00.000Z",
      addedBy:"tool"
    },
    {
      id:"EX-2",
      evidenceId:"EV-1",
      tool:"text-projector",
      extractor:"text-projection-v1",
      sourceUri:"https://example.com/source",
      sourceSha256:"a".repeat(64),
      projectionSha256:"b".repeat(64),
      excerptSha256:"d".repeat(64),
      contentType:"text/html",
      startChar:20,
      endChar:30,
      text:"Exact beta",
      extractedAt:"2026-10-01T12:01:00.000Z",
      addedBy:"tool"
    }
  ];
  return state;
};

const validPayload=()=>JSON.stringify({
  summary:"The excerpts provide a provenance claim but leave implementation scope unresolved.",
  points:[
    {
      excerptId:"EX-1",
      premise:"The first excerpt states an exact provenance property.",
      inference:"If the mechanism is implemented as described, it supports the claim's provenance component.",
      objection:"The excerpt alone does not establish behavior outside the cited mechanism."
    },
    {
      excerptId:"EX-2",
      premise:"The second excerpt adds another part of the provenance description.",
      inference:"Together with the first excerpt it broadens the described mechanism.",
      objection:"The relationship remains dependent on the operator-bound source context."
    }
  ],
  unresolvedGaps:["No independent implementation trace is included in these excerpts."]
});

describe("argument review provider boundary",()=>{
  it("labels excerpts as untrusted data and requires raw JSON",()=>{
    const messages=buildArgumentReviewMessages(prepared(),"CL-1");

    expect(messages[0]?.content).toMatch(/UNTRUSTED DATA/);
    expect(messages[0]?.content).toMatch(/Do not invent quotations/i);
    expect(messages[0]?.content).toMatch(/raw JSON only/i);
    expect(messages[1]?.content).toContain("EX-1");
    expect(messages[1]?.content).toContain("Exact alpha");
  });

  it("parses a complete one-point-per-excerpt review",()=>{
    const parsed=parseArgumentReviewResponse(prepared(),"CL-1",validPayload());

    expect(parsed.points.map(point=>point.excerptId)).toEqual(["EX-1","EX-2"]);
    expect(parsed.unresolvedGaps).toHaveLength(1);
    expect(parsed.summary).toMatch(/provenance claim/i);
  });

  it("rejects markdown-fenced output instead of guessing",()=>{
    const fence=String.fromCharCode(96).repeat(3);
    expect(()=>parseArgumentReviewResponse(
      prepared(),
      "CL-1",
      fence+"json\n"+validPayload()+"\n"+fence
    )).toThrow(/raw valid JSON/i);
  });

  it("rejects an excerpt id outside the canonical claim basis",()=>{
    const payload=JSON.parse(validPayload());
    payload.points[1].excerptId="EX-999";

    expect(()=>parseArgumentReviewResponse(
      prepared(),"CL-1",JSON.stringify(payload)
    )).toThrow(/outside the claim basis/i);
  });

  it("rejects duplicate excerpt citations",()=>{
    const payload=JSON.parse(validPayload());
    payload.points[1].excerptId="EX-1";

    expect(()=>parseArgumentReviewResponse(
      prepared(),"CL-1",JSON.stringify(payload)
    )).toThrow(/more than once/i);
  });

  it("rejects omission of an eligible excerpt",()=>{
    const payload=JSON.parse(validPayload());
    payload.points=payload.points.slice(0,1);

    expect(()=>parseArgumentReviewResponse(
      prepared(),"CL-1",JSON.stringify(payload)
    )).toThrow(/every eligible excerpt exactly once/i);
  });

  it("rejects oversized analysis fields",()=>{
    const payload=JSON.parse(validPayload());
    payload.points[0].inference="x".repeat(801);

    expect(()=>parseArgumentReviewResponse(
      prepared(),"CL-1",JSON.stringify(payload)
    )).toThrow(/inference exceeds 800/i);
  });

  it("rejects more than eight unresolved gaps",()=>{
    const payload=JSON.parse(validPayload());
    payload.unresolvedGaps=Array.from({length:9},(_,index)=>"gap "+index);

    expect(()=>parseArgumentReviewResponse(
      prepared(),"CL-1",JSON.stringify(payload)
    )).toThrow(/at most 8 unresolved gaps/i);
  });
});
