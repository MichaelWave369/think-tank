import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {
  releaseManifestDigestSha256,
  sealReleaseWithPrivateKey,
  verifyReleaseSealReceipt
} from "./provider-bridge.mjs";

const manifest=()=>({
  schemaVersion:1,
  id:"REL-DOS-0001-integrity-deadbeef",
  dossierId:"DOS-0001",
  policy:"integrity",
  assuranceReportId:"ASSURE-DOS-0001-integrity-cafebabe",
  assuranceBasisFingerprint:"fnv1a32:cafebabe",
  checkpointId:"CHK-000001-123456789abc",
  operatorOverrideId:"",
  artifactIds:[
    "ASSURE-DOS-0001-integrity-cafebabe",
    "CHK-000001-123456789abc",
    "DOS-0001"
  ],
  manifestFingerprint:"fnv1a32:deadbeef",
  releaseAuthority:"fresh-passing-provenance-policy",
  truthAuthority:false
});

const keypair=()=>{
  const {privateKey}=generateKeyPairSync("ed25519");
  return privateKey.export({type:"pkcs8",format:"pem"}).toString();
};

test("release manifest SHA-256 is stable across object key order",()=>{
  const original=manifest();
  const reordered={
    truthAuthority:original.truthAuthority,
    releaseAuthority:original.releaseAuthority,
    manifestFingerprint:original.manifestFingerprint,
    artifactIds:original.artifactIds,
    operatorOverrideId:original.operatorOverrideId,
    checkpointId:original.checkpointId,
    assuranceBasisFingerprint:original.assuranceBasisFingerprint,
    assuranceReportId:original.assuranceReportId,
    policy:original.policy,
    dossierId:original.dossierId,
    id:original.id,
    schemaVersion:original.schemaVersion
  };
  assert.equal(
    releaseManifestDigestSha256(original),
    releaseManifestDigestSha256(reordered)
  );
});

test("signs and verifies a release manifest with Ed25519",()=>{
  const value=manifest();
  const seal=sealReleaseWithPrivateKey(
    value,
    keypair(),
    "test-release-key",
    "2026-10-02T05:00:00.000Z"
  );
  const result=verifyReleaseSealReceipt(value,seal);

  assert.equal(result.verified,true);
  assert.equal(seal.releaseId,value.id);
  assert.equal(seal.dossierId,value.dossierId);
  assert.equal(seal.clock,"untrusted-local-clock");
  assert.equal(seal.trust,"self-attested-local-release-key");
  assert.equal(seal.id,"RSEAL-"+value.id+"-"+seal.publicKeyFingerprintSha256.slice(0,12));
});

test("detects a release manifest changed after signing",()=>{
  const value=manifest();
  const seal=sealReleaseWithPrivateKey(value,keypair(),"test-release-key");
  const changed={...value,artifactIds:[...value.artifactIds,"NEW-ARTIFACT"]};

  const result=verifyReleaseSealReceipt(changed,seal);
  assert.equal(result.verified,false);
  assert.match(result.reason,/SHA-256 does not match/i);
});

test("detects a forged release public-key fingerprint",()=>{
  const value=manifest();
  const seal=sealReleaseWithPrivateKey(value,keypair(),"test-release-key");
  const forged={...seal,publicKeyFingerprintSha256:"0".repeat(64)};

  const result=verifyReleaseSealReceipt(value,forged);
  assert.equal(result.verified,false);
  assert.match(result.reason,/fingerprint does not match/i);
});

test("detects a modified release signature",()=>{
  const value=manifest();
  const seal=sealReleaseWithPrivateKey(value,keypair(),"test-release-key");
  const bytes=Buffer.from(seal.signatureBase64,"base64");
  bytes[0]^=0xff;
  const changed={...seal,signatureBase64:bytes.toString("base64")};

  const result=verifyReleaseSealReceipt(value,changed);
  assert.equal(result.verified,false);
  assert.match(result.reason,/verification failed/i);
});
