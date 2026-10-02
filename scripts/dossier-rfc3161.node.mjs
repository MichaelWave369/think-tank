import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDossierTransparencyReceipt,
  buildTransparencyCheckpoint,
  buildRfc3161TimestampReceipt,
  parseRfc3161ReplyText
} from "./provider-bridge.mjs";

const checkpoint=()=>{
  const seal={
    id:"SEAL-DOS-0001-"+"a".repeat(12),
    dossierId:"DOS-0001",
    digestSha256:"b".repeat(64),
    publicKeyFingerprintSha256:"a".repeat(64)
  };
  const entry=buildDossierTransparencyReceipt(
    seal,1,"0".repeat(64),"2026-10-01T22:10:00.000Z"
  );
  return buildTransparencyCheckpoint([entry],"2026-10-01T22:11:00.000Z");
};

test("parses OpenSSL RFC3161 reply text",()=>{
  const parsed=parseRfc3161ReplyText([
    "Status info:",
    "Status: Granted.",
    "TST info:",
    "Version: 1",
    "Policy OID: 1.2.3.4.5",
    "Hash Algorithm: sha256",
    "Serial number: 0x01AF",
    "Time stamp: Oct  1 22:12:00 2026 GMT",
    "Accuracy: unspecified",
    "TSA: DirName:/CN=Example TSA/O=Example"
  ].join("\n"));

  assert.equal(parsed.tsaPolicyOid,"1.2.3.4.5");
  assert.equal(parsed.tsaSerialNumber,"0x01AF");
  assert.equal(parsed.genTime,"2026-10-01T22:12:00.000Z");
  assert.equal(parsed.tsaSubject,"DirName:/CN=Example TSA/O=Example");
});

test("builds a portable RFC3161 receipt around a verified token",()=>{
  const chk=checkpoint();
  const token=Buffer.from("fake-rfc3161-token-for-receipt-shape");
  const receipt=buildRfc3161TimestampReceipt({
    checkpoint:chk,
    tokenBytes:token,
    metadata:{
      tsaPolicyOid:"1.2.3.4.5",
      tsaSerialNumber:"0x01AF",
      genTime:"2026-10-01T22:12:00.000Z",
      tsaSubject:"DirName:/CN=Example TSA/O=Example"
    },
    authorityUrl:"https://tsa.example.test",
    trustAnchorSha256:"c".repeat(64),
    verifiedAt:"2026-10-01T22:12:01.000Z"
  });

  assert.equal(receipt.checkpointId,chk.id);
  assert.equal(receipt.checkpointSha256,chk.checkpointSha256);
  assert.equal(receipt.standard,"RFC3161");
  assert.equal(receipt.hashAlgorithm,"SHA-256");
  assert.match(receipt.tokenSha256,/^[a-f0-9]{64}$/);
  assert.equal(receipt.tokenBase64,token.toString("base64"));
  assert.equal(receipt.authorityUrl,"https://tsa.example.test/");
  assert.equal(receipt.id,"TSA-"+chk.id+"-"+receipt.tokenSha256.slice(0,12));
});

test("rejects malformed RFC3161 metadata",()=>{
  const chk=checkpoint();
  assert.throws(
    ()=>buildRfc3161TimestampReceipt({
      checkpoint:chk,
      tokenBytes:Buffer.from("token"),
      metadata:{
        tsaPolicyOid:"",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-01T22:12:00.000Z",
        tsaSubject:"Example"
      },
      authorityUrl:"https://tsa.example.test",
      trustAnchorSha256:"c".repeat(64),
      verifiedAt:"2026-10-01T22:12:01.000Z"
    }),
    /metadata is incomplete/i
  );
});

test("rejects embedded credentials in configured TSA URLs",()=>{
  const chk=checkpoint();
  assert.throws(
    ()=>buildRfc3161TimestampReceipt({
      checkpoint:chk,
      tokenBytes:Buffer.from("token"),
      metadata:{
        tsaPolicyOid:"1.2.3",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-01T22:12:00.000Z",
        tsaSubject:"Example"
      },
      authorityUrl:"https://user:pass@tsa.example.test",
      trustAnchorSha256:"c".repeat(64),
      verifiedAt:"2026-10-01T22:12:01.000Z"
    }),
    /must not contain embedded credentials/i
  );
});
