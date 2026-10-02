import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync} from "node:crypto";
import {
  buildReleasePublicationAuditReceipt,
  buildReleasePublicationReceipt,
  releasePackageBasisFingerprintBridge,
  sealReleaseWithPrivateKey,
  stableCanonicalJson
} from "./provider-bridge.mjs";

const packageValue=()=>{
  const manifest={
    schemaVersion:1,
    id:"REL-DOS-0001-integrity-deadbeef",
    dossierId:"DOS-0001",
    policy:"integrity",
    assuranceReportId:"ASSURE-DOS-0001-integrity-cafebabe",
    assuranceBasisFingerprint:"fnv1a32:cafebabe",
    checkpointId:"CHK-000001-123456789abc",
    operatorOverrideId:"",
    artifactIds:[],
    manifestFingerprint:"fnv1a32:deadbeef",
    releaseAuthority:"fresh-passing-provenance-policy",
    truthAuthority:false
  };
  const {privateKey}=generateKeyPairSync("ed25519");
  const pem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const seal=sealReleaseWithPrivateKey(
    manifest,pem,"release-test","2026-10-02T08:00:00.000Z"
  );
  return {
    schemaVersion:1,
    releaseManifest:manifest,
    releaseSeals:[seal],
    releaseSealVerifications:[{
      id:"RVER-"+seal.id,
      releaseId:manifest.id,
      sealId:seal.id,
      tool:"ed25519-release-verifier",
      algorithm:"Ed25519",
      manifestSha256:seal.manifestSha256,
      publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
      verified:true,
      verifiedAt:"2026-10-02T08:00:01.000Z"
    }],
    releaseRfc3161Timestamps:[],
    artifacts:[]
  };
};

const publicationFor=(pkg)=>{
  const fingerprint=releasePackageBasisFingerprintBridge(pkg);
  const packageSha256=createHash("sha256")
    .update(stableCanonicalJson(pkg),"utf8")
    .digest("hex");
  return buildReleasePublicationReceipt({
    packageValue:pkg,
    packageBasisFingerprint:fingerprint,
    publisherResponse:{
      protocol:"phi-release-publication-v1",
      publicationId:"pub-1",
      releaseId:pkg.releaseManifest.id,
      packageSha256,
      retrievalUrl:"https://public.example.test/releases/pkg.json",
      publishedAt:"2026-10-02T08:01:00.000Z"
    },
    publisherUrl:"https://publisher.example.test/publish",
    retrievalOrigin:"https://public.example.test",
    retrievedPackage:pkg,
    retrievalVerifiedAt:"2026-10-02T08:01:01.000Z"
  });
};

test("builds RAUD after exact repeat retrieval of historical RPUB package",()=>{
  const pkg=packageValue();
  const publication=publicationFor(pkg);
  const audit=buildReleasePublicationAuditReceipt({
    packageValue:pkg,
    publication,
    retrievedPackage:pkg,
    checkedAt:"2026-10-02T09:00:00.000Z"
  });

  assert.equal(audit.releaseId,publication.releaseId);
  assert.equal(audit.publicationReceiptId,publication.id);
  assert.equal(audit.publicationReceiptSha256,publication.receiptSha256);
  assert.equal(audit.packageSha256,publication.packageSha256);
  assert.equal(audit.readbackSha256,publication.packageSha256);
  assert.equal(audit.exactMatch,true);
  assert.equal(audit.clock,"untrusted-local-clock");
  assert.equal(audit.trust,"repeat-external-retrieval");
  assert.equal(audit.id,"RAUD-"+publication.id+"-"+audit.receiptSha256.slice(0,12));
});

test("rejects changed package during repeat retrieval",()=>{
  const pkg=packageValue();
  const publication=publicationFor(pkg);
  const changed={...pkg,unexpected:"changed"};

  assert.throws(
    ()=>buildReleasePublicationAuditReceipt({
      packageValue:pkg,
      publication,
      retrievedPackage:changed
    }),
    /does not exactly match/i
  );
});

test("rejects RPUB whose package SHA-256 no longer matches historical package",()=>{
  const pkg=packageValue();
  const publication={...publicationFor(pkg),packageSha256:"0".repeat(64)};

  assert.throws(
    ()=>buildReleasePublicationAuditReceipt({
      packageValue:pkg,
      publication,
      retrievedPackage:pkg
    }),
    /SHA-256 does not match RPUB/i
  );
});

test("repeat successful audits get distinct receipt ids from distinct check times",()=>{
  const pkg=packageValue();
  const publication=publicationFor(pkg);
  const first=buildReleasePublicationAuditReceipt({
    packageValue:pkg,
    publication,
    retrievedPackage:pkg,
    checkedAt:"2026-10-02T09:00:00.000Z"
  });
  const second=buildReleasePublicationAuditReceipt({
    packageValue:pkg,
    publication,
    retrievedPackage:pkg,
    checkedAt:"2026-10-03T09:00:00.000Z"
  });

  assert.notEqual(first.id,second.id);
  assert.notEqual(first.receiptSha256,second.receiptSha256);
});
