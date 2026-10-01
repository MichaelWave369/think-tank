import { describe,expect,it } from "vitest";
import { createInitialState } from "./state";
import {
  buildDecisionOverrideReceipt,
  buildSynthesisDecisionDossier,
  decisionDossierBasis,
  overrideForDossier
} from "./decisionDossier";

describe("synthesis decision dossier",()=>{
  it("is deterministic for the same decision basis",()=>{
    const state=createInitialState();

    const first=buildSynthesisDecisionDossier(
      state,42,"withheld","WITHHELD",false,"Policy blocked."
    );
    const second=buildSynthesisDecisionDossier(
      state,42,"withheld","WITHHELD",false,"Policy blocked."
    );

    expect(second).toEqual(first);
    expect(first.id).toBe("DOS-0042");
    expect(first.basisFingerprint).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
  });

  it("changes fingerprint when decision-relevant claim relations change",()=>{
    const state=createInitialState();
    state.claims=[{id:"CL-1",text:"Claim.",addedBy:"operator"}];
    state.evidenceRefs=[{
      id:"EV-1",
      kind:"operator-reference",
      verification:"operator-attested",
      label:"Source",
      addedBy:"operator"
    }];
    state.claimBindings=[{
      id:"CB-1",
      claimId:"CL-1",
      evidenceId:"EV-1",
      relation:"supports",
      addedBy:"operator"
    }];

    const before=buildSynthesisDecisionDossier(
      state,10,"completed","STANDARD",true,"Allowed."
    );

    state.claimBindings[0]={...state.claimBindings[0]!,relation:"contradicts"};

    const after=buildSynthesisDecisionDossier(
      state,10,"completed","STANDARD",true,"Allowed."
    );

    expect(after.basisFingerprint).not.toBe(before.basisFingerprint);
    expect(after.bindings[0]?.relation).toBe("contradicts");
  });

  it("records compact evidence and excerpt provenance rather than full page bodies",()=>{
    const state=createInitialState();
    state.evidenceRefs=[{
      id:"EV-1",
      kind:"external-source",
      verification:"machine-verified",
      label:"Verified source",
      uri:"https://example.com/source",
      researchCandidateId:"RC-1",
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
      startChar:5,
      endChar:16,
      text:"Exact quote",
      extractedAt:"2026-10-01T12:01:00.000Z",
      addedBy:"tool"
    }];

    const basis=decisionDossierBasis(
      state,9,"withheld","WITHHELD",false,"Blocked."
    );

    expect(basis.evidence[0]?.retrievalSha256).toBe("a".repeat(64));
    expect(basis.evidence[0]?.researchCandidateId).toBe("RC-1");
    expect(basis.excerpts[0]).toMatchObject({
      id:"EX-1",
      evidenceId:"EV-1",
      excerptSha256:"c".repeat(64),
      startChar:5,
      endChar:16
    });
    expect(JSON.stringify(basis.excerpts)).not.toContain("Exact quote");
  });

  it("creates a separate linked override receipt without changing the dossier",()=>{
    const state=createInitialState();
    const dossier=buildSynthesisDecisionDossier(
      state,12,"withheld","WITHHELD",false,"Blocked."
    );
    state.decisionDossiers=[dossier];

    const receipt=buildDecisionOverrideReceipt(
      state,13,"STANDARD","Human override."
    );

    expect(receipt.dossierId).toBe("DOS-0012");
    expect(receipt.id).toBe("OVR-0013");
    expect(dossier.outcome).toBe("withheld");
    expect(dossier.actionAllowed).toBe(false);

    state.decisionOverrides=[receipt];
    expect(overrideForDossier(state,dossier.id)).toEqual(receipt);
    expect(()=>buildDecisionOverrideReceipt(
      state,14,"STANDARD","Second override."
    )).toThrow(/already has an operator override/i);
  });

  it("refuses to attach FORCE SYNTHESIS to a completed dossier",()=>{
    const state=createInitialState();
    state.decisionDossiers=[buildSynthesisDecisionDossier(
      state,7,"completed","STANDARD",true,"Allowed."
    )];

    expect(()=>buildDecisionOverrideReceipt(
      state,8,"STANDARD","Invalid override."
    )).toThrow(/prior withheld decision dossier/i);
  });
});
