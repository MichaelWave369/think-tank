import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {
  buildDossierTransparencyReceipt,
  buildTransparencyCheckpoint,
  signTransparencyCheckpointWithPrivateKey,
  verifyTransparencyWitnessReceipt
} from "./provider-bridge.mjs";

const seal=(fingerprint="a".repeat(64))=>({
  id:"SEAL-DOS-0001-"+fingerprint.slice(0,12),
  dossierId:"DOS-0001",
  digestSha256:"b".repeat(64),
  publicKeyFingerprintSha256:fingerprint
});

const journal=()=>{
  const first=buildDossierTransparencyReceipt(
    seal(),
    1,
    "0".repeat(64),
    "2026-10-01T22:10:00.000Z"
  );
  const second=buildDossierTransparencyReceipt(
    seal("c".repeat(64)),
    2,
    first.entrySha256,
    "2026-10-01T22:11:00.000Z"
  );
  return [first,second];
};

test("builds a portable checkpoint from the verified journal head",()=>{
  const entries=journal();
  const checkpoint=buildTransparencyCheckpoint(entries,"2026-10-01T22:12:00.000Z");
  assert.equal(checkpoint.entryCount,2);
  assert.equal(checkpoint.headEntryId,entries[1].id);
  assert.equal(checkpoint.headSha256,entries[1].entrySha256);
  assert.match(checkpoint.checkpointSha256,/^[a-f0-9]{64}$/);
  assert.equal(
    checkpoint.id,
    "CHK-000002-"+checkpoint.checkpointSha256.slice(0,12)
  );
});

test("signs and verifies a detached Ed25519 checkpoint witness",()=>{
  const checkpoint=buildTransparencyCheckpoint(journal(),"2026-10-01T22:12:00.000Z");
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const witness=signTransparencyCheckpointWithPrivateKey(
    checkpoint,
    privatePem,
    "remote-lab",
    "2026-10-01T22:13:00.000Z"
  );
  const result=verifyTransparencyWitnessReceipt(checkpoint,witness);
  assert.equal(result.verified,true);
  assert.match(witness.publicKeyFingerprintSha256,/^[a-f0-9]{64}$/);
  assert.equal(witness.trust,"self-attested-external-witness-key");
});

test("detects a modified witness signature",()=>{
  const checkpoint=buildTransparencyCheckpoint(journal(),"2026-10-01T22:12:00.000Z");
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const witness=signTransparencyCheckpointWithPrivateKey(
    checkpoint,
    privatePem,
    "remote-lab",
    "2026-10-01T22:13:00.000Z"
  );
  const tampered={...witness,signatureBase64:Buffer.from("not-the-signature").toString("base64")};
  const result=verifyTransparencyWitnessReceipt(checkpoint,tampered);
  assert.equal(result.verified,false);
});

test("rejects a checkpoint whose digest was changed",()=>{
  const checkpoint=buildTransparencyCheckpoint(journal(),"2026-10-01T22:12:00.000Z");
  const {privateKey}=generateKeyPairSync("ed25519");
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const witness=signTransparencyCheckpointWithPrivateKey(
    checkpoint,
    privatePem,
    "remote-lab",
    "2026-10-01T22:13:00.000Z"
  );
  assert.throws(
    ()=>verifyTransparencyWitnessReceipt({...checkpoint,checkpointSha256:"f".repeat(64)},witness),
    /digest or id is invalid/i
  );
});
