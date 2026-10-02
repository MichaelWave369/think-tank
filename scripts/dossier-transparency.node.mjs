import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDossierTransparencyReceipt,
  verifyDossierTransparencyEntries
} from "./provider-bridge.mjs";

const seal=(id="SEAL-DOS-0001-aaaaaaaaaaaa")=>({
  id,
  dossierId:"DOS-0001",
  digestSha256:"b".repeat(64),
  publicKeyFingerprintSha256:"a".repeat(64)
});

test("transparency journal builds and verifies a genesis entry",()=>{
  const first=buildDossierTransparencyReceipt(
    seal(),
    1,
    "0".repeat(64),
    "2026-10-01T22:10:00.000Z"
  );
  assert.match(first.entrySha256,/^[a-f0-9]{64}$/);
  assert.equal(first.id,"TLOG-000001-"+first.entrySha256.slice(0,12));
  assert.equal(verifyDossierTransparencyEntries([first]).verified,true);
});

test("transparency journal hash-links later entries",()=>{
  const first=buildDossierTransparencyReceipt(
    seal(),
    1,
    "0".repeat(64),
    "2026-10-01T22:10:00.000Z"
  );
  const second=buildDossierTransparencyReceipt(
    {...seal("SEAL-DOS-0001-bbbbbbbbbbbb"),publicKeyFingerprintSha256:"c".repeat(64)},
    2,
    first.entrySha256,
    "2026-10-01T22:11:00.000Z"
  );
  const result=verifyDossierTransparencyEntries([first,second]);
  assert.equal(result.verified,true);
  assert.equal(result.entryCount,2);
  assert.equal(result.headSha256,second.entrySha256);
});

test("transparency journal detects historical tampering",()=>{
  const first=buildDossierTransparencyReceipt(
    seal(),
    1,
    "0".repeat(64),
    "2026-10-01T22:10:00.000Z"
  );
  const tampered={...first,dossierSha256:"f".repeat(64)};
  const result=verifyDossierTransparencyEntries([tampered]);
  assert.equal(result.verified,false);
  assert.match(result.reason,/digest or metadata/i);
});
