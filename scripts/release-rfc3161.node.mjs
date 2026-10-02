import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRfc3161ReleaseSealTimestampReceipt,
  releaseSealDigestSha256
} from "./provider-bridge.mjs";

const seal=()=>({
  id:"RSEAL-REL-DOS-0001-integrity-deadbeef-"+"a".repeat(12),
  releaseId:"REL-DOS-0001-integrity-deadbeef",
  dossierId:"DOS-0001",
  tool:"ed25519-release-sealer",
  algorithm:"Ed25519",
  canonicalization:"json-stable-v1",
  manifestSha256:"b".repeat(64),
  publicKeyPem:"-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
  publicKeyFingerprintSha256:"a".repeat(64),
  signatureBase64:"AQIDBAUG",
  signedAt:"2026-10-02T06:00:00.000Z",
  clock:"untrusted-local-clock",
  signerLabel:"release-test",
  trust:"self-attested-local-release-key"
});

test("release seal SHA-256 is stable across object key order",()=>{
  const original=seal();
  const reordered={
    trust:original.trust,
    signerLabel:original.signerLabel,
    clock:original.clock,
    signedAt:original.signedAt,
    signatureBase64:original.signatureBase64,
    publicKeyFingerprintSha256:original.publicKeyFingerprintSha256,
    publicKeyPem:original.publicKeyPem,
    manifestSha256:original.manifestSha256,
    canonicalization:original.canonicalization,
    algorithm:original.algorithm,
    tool:original.tool,
    dossierId:original.dossierId,
    releaseId:original.releaseId,
    id:original.id
  };

  assert.equal(
    releaseSealDigestSha256(original),
    releaseSealDigestSha256(reordered)
  );
});

test("builds RFC3161 trusted-time receipt around an exact release seal",()=>{
  const value=seal();
  const token=Buffer.from("fake-release-rfc3161-token");
  const receipt=buildRfc3161ReleaseSealTimestampReceipt({
    seal:value,
    tokenBytes:token,
    metadata:{
      tsaPolicyOid:"1.2.3.4.6",
      tsaSerialNumber:"0xBEEF",
      genTime:"2026-10-02T06:01:00.000Z",
      tsaSubject:"DirName:/CN=Release TSA/O=Example"
    },
    authorityUrl:"https://tsa.example.test",
    trustAnchorSha256:"c".repeat(64),
    verifiedAt:"2026-10-02T06:01:01.000Z"
  });

  assert.equal(receipt.releaseId,value.releaseId);
  assert.equal(receipt.sealId,value.id);
  assert.equal(receipt.releaseSealSha256,releaseSealDigestSha256(value));
  assert.equal(receipt.manifestSha256,value.manifestSha256);
  assert.equal(receipt.publicKeyFingerprintSha256,value.publicKeyFingerprintSha256);
  assert.equal(receipt.standard,"RFC3161");
  assert.equal(receipt.hashAlgorithm,"SHA-256");
  assert.equal(receipt.trust,"configured-rfc3161-trust-anchor");
  assert.match(receipt.tokenSha256,/^[a-f0-9]{64}$/);
  assert.equal(receipt.tokenBase64,token.toString("base64"));
  assert.equal(receipt.authorityUrl,"https://tsa.example.test/");
  assert.equal(receipt.id,"RTSA-"+value.id+"-"+receipt.tokenSha256.slice(0,12));
});

test("rejects malformed release timestamp metadata",()=>{
  assert.throws(
    ()=>buildRfc3161ReleaseSealTimestampReceipt({
      seal:seal(),
      tokenBytes:Buffer.from("token"),
      metadata:{
        tsaPolicyOid:"",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-02T06:01:00.000Z",
        tsaSubject:"Example"
      },
      authorityUrl:"https://tsa.example.test",
      trustAnchorSha256:"c".repeat(64),
      verifiedAt:"2026-10-02T06:01:01.000Z"
    }),
    /metadata is incomplete/i
  );
});

test("rejects invalid release timestamp trust-anchor digest",()=>{
  assert.throws(
    ()=>buildRfc3161ReleaseSealTimestampReceipt({
      seal:seal(),
      tokenBytes:Buffer.from("token"),
      metadata:{
        tsaPolicyOid:"1.2.3",
        tsaSerialNumber:"0x01",
        genTime:"2026-10-02T06:01:00.000Z",
        tsaSubject:"Example"
      },
      authorityUrl:"https://tsa.example.test",
      trustAnchorSha256:"not-a-digest",
      verifiedAt:"2026-10-02T06:01:01.000Z"
    }),
    /trust-anchor digest is invalid/i
  );
});
