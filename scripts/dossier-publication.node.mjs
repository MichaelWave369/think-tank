import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckpointPublicationReceipt,
  buildDossierTransparencyReceipt,
  buildTransparencyCheckpoint,
  validateCheckpointPublicationResponse
} from "./provider-bridge.mjs";

const checkpoint=()=>{
  const seal={
    id:"SEAL-DOS-0001-"+"a".repeat(12),
    dossierId:"DOS-0001",
    digestSha256:"b".repeat(64),
    publicKeyFingerprintSha256:"a".repeat(64)
  };
  const entry=buildDossierTransparencyReceipt(
    seal,1,"0".repeat(64),"2026-10-02T01:00:00.000Z"
  );
  return buildTransparencyCheckpoint([entry],"2026-10-02T01:01:00.000Z");
};

const publisherResponse=(chk)=>({
  protocol:"phi-checkpoint-publication-v1",
  publicationId:"publication-001",
  checkpointId:chk.id,
  checkpointSha256:chk.checkpointSha256,
  retrievalUrl:"https://public.example.test/checkpoints/"+encodeURIComponent(chk.id)+".json",
  publishedAt:"2026-10-02T01:02:00.000Z"
});

test("validates phi-checkpoint-publication-v1 response linkage",()=>{
  const chk=checkpoint();
  const normalized=validateCheckpointPublicationResponse({
    checkpoint:chk,
    publisherResponse:publisherResponse(chk),
    publisherUrl:"https://api.example.test/publish",
    retrievalOrigin:"https://public.example.test"
  });

  assert.equal(normalized.checkpointId,chk.id);
  assert.equal(normalized.checkpointSha256,chk.checkpointSha256);
  assert.equal(normalized.publicationId,"publication-001");
  assert.equal(normalized.publisherUrl,"https://api.example.test/publish");
});

test("builds a receipt only after exact checkpoint read-back",()=>{
  const chk=checkpoint();
  const receipt=buildCheckpointPublicationReceipt({
    checkpoint:chk,
    publisherResponse:publisherResponse(chk),
    publisherUrl:"https://api.example.test/publish",
    retrievalOrigin:"https://public.example.test",
    retrievedCheckpoint:{...chk},
    retrievalHttpStatus:200,
    retrievalContentType:"application/json; charset=utf-8",
    retrievalVerifiedAt:"2026-10-02T01:02:01.000Z"
  });

  assert.equal(receipt.checkpointId,chk.id);
  assert.equal(receipt.tool,"verified-checkpoint-publisher");
  assert.equal(receipt.protocol,"phi-checkpoint-publication-v1");
  assert.equal(receipt.trust,"externally-retrieved-publication");
  assert.match(receipt.payloadSha256,/^[a-f0-9]{64}$/);
  assert.match(receipt.receiptSha256,/^[a-f0-9]{64}$/);
  assert.equal(receipt.id,"PUB-"+chk.id+"-"+receipt.receiptSha256.slice(0,12));
});

test("rejects a retrieval URL outside the configured origin",()=>{
  const chk=checkpoint();
  const response={
    ...publisherResponse(chk),
    retrievalUrl:"https://other.example.test/checkpoints/"+chk.id+".json"
  };

  assert.throws(
    ()=>validateCheckpointPublicationResponse({
      checkpoint:chk,
      publisherResponse:response,
      publisherUrl:"https://api.example.test/publish",
      retrievalOrigin:"https://public.example.test"
    }),
    /origin does not match configured retrieval origin/i
  );
});

test("rejects modified checkpoint content on read-back",()=>{
  const chk=checkpoint();
  const modified={...chk,headSha256:"f".repeat(64)};

  assert.throws(
    ()=>buildCheckpointPublicationReceipt({
      checkpoint:chk,
      publisherResponse:publisherResponse(chk),
      publisherUrl:"https://api.example.test/publish",
      retrievalOrigin:"https://public.example.test",
      retrievedCheckpoint:modified,
      retrievalHttpStatus:200,
      retrievalContentType:"application/json",
      retrievalVerifiedAt:"2026-10-02T01:02:01.000Z"
    }),
    /digest or id is invalid|does not exactly match/i
  );
});

test("rejects publisher response checkpoint mismatch",()=>{
  const chk=checkpoint();
  const response={...publisherResponse(chk),checkpointSha256:"f".repeat(64)};

  assert.throws(
    ()=>validateCheckpointPublicationResponse({
      checkpoint:chk,
      publisherResponse:response,
      publisherUrl:"https://api.example.test/publish",
      retrievalOrigin:"https://public.example.test"
    }),
    /does not match phi-checkpoint-publication-v1/i
  );
});
