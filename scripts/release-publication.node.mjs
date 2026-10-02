import test from "node:test";
import assert from "node:assert/strict";
import {createHash,generateKeyPairSync} from "node:crypto";
import {
  buildReleasePublicationReceipt,
  releaseManifestDigestSha256,
  releasePackageBasisFingerprintBridge,
  sealReleaseWithPrivateKey,
  stableCanonicalJson,
  validateReleasePackage
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
  artifactIds:[],
  manifestFingerprint:"fnv1a32:deadbeef",
  releaseAuthority:"fresh-passing-provenance-policy",
  truthAuthority:false
});

const packageValue=()=>{
  const value=manifest();
  const {privateKey}=generateKeyPairSync("ed25519");
  const pem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const seal=sealReleaseWithPrivateKey(
    value,pem,"release-test","2026-10-02T07:10:00.000Z"
  );
  const verification={
    id:"RVER-"+seal.id,
    releaseId:value.id,
    sealId:seal.id,
    tool:"ed25519-release-verifier",
    algorithm:"Ed25519",
    manifestSha256:seal.manifestSha256,
    publicKeyFingerprintSha256:seal.publicKeyFingerprintSha256,
    verified:true,
    verifiedAt:"2026-10-02T07:10:01.000Z"
  };
  return {
    schemaVersion:1,
    releaseManifest:value,
    releaseSeals:[seal],
    releaseSealVerifications:[verification],
    releaseRfc3161Timestamps:[],
    artifacts:[]
  };
};

test("validates a canonical release package with verified RSEAL",()=>{
  const pkg=packageValue();
  assert.equal(validateReleasePackage(pkg),pkg);
  assert.match(releasePackageBasisFingerprintBridge(pkg),/^fnv1a32:[a-f0-9]{8}$/);
});

test("rejects package with no successful RVER",()=>{
  const pkg=packageValue();
  assert.throws(
    ()=>validateReleasePackage({...pkg,releaseSealVerifications:[]}),
    /requires at least one successfully verified release seal/i
  );
});

test("builds RPUB only after exact canonical read-back",()=>{
  const pkg=packageValue();
  const fingerprint=releasePackageBasisFingerprintBridge(pkg);
  const packageSha256=createHash("sha256")
    .update(stableCanonicalJson(pkg),"utf8")
    .digest("hex");
  const response={
    protocol:"phi-release-publication-v1",
    publicationId:"release-pub-1",
    releaseId:pkg.releaseManifest.id,
    packageSha256,
    retrievalUrl:"https://public.example.test/releases/package.json",
    publishedAt:"2026-10-02T07:11:00.000Z"
  };
  const receipt=buildReleasePublicationReceipt({
    packageValue:pkg,
    packageBasisFingerprint:fingerprint,
    publisherResponse:response,
    publisherUrl:"https://publisher.example.test/publish",
    retrievalOrigin:"https://public.example.test",
    retrievedPackage:pkg,
    retrievalVerifiedAt:"2026-10-02T07:11:01.000Z"
  });

  assert.equal(receipt.releaseId,pkg.releaseManifest.id);
  assert.equal(receipt.packageBasisFingerprint,fingerprint);
  assert.equal(receipt.manifestSha256,releaseManifestDigestSha256(pkg.releaseManifest));
  assert.equal(receipt.packageSha256,packageSha256);
  assert.equal(receipt.id,"RPUB-"+pkg.releaseManifest.id+"-"+receipt.receiptSha256.slice(0,12));
});

test("rejects altered public read-back even when ids are unchanged",()=>{
  const pkg=packageValue();
  const fingerprint=releasePackageBasisFingerprintBridge(pkg);
  const packageSha256=createHash("sha256")
    .update(stableCanonicalJson(pkg),"utf8")
    .digest("hex");
  const response={
    protocol:"phi-release-publication-v1",
    publicationId:"release-pub-1",
    releaseId:pkg.releaseManifest.id,
    packageSha256,
    retrievalUrl:"https://public.example.test/releases/package.json",
    publishedAt:"2026-10-02T07:11:00.000Z"
  };
  const altered={
    ...pkg,
    unexpectedReadbackField:"tampered"
  };

  assert.throws(
    ()=>buildReleasePublicationReceipt({
      packageValue:pkg,
      packageBasisFingerprint:fingerprint,
      publisherResponse:response,
      publisherUrl:"https://publisher.example.test/publish",
      retrievalOrigin:"https://public.example.test",
      retrievedPackage:altered
    }),
    /does not exactly match/i
  );
});

test("rejects forged browser package fingerprint",()=>{
  const pkg=packageValue();
  const packageSha256=createHash("sha256")
    .update(stableCanonicalJson(pkg),"utf8")
    .digest("hex");
  assert.throws(
    ()=>buildReleasePublicationReceipt({
      packageValue:pkg,
      packageBasisFingerprint:"fnv1a32:00000000",
      publisherResponse:{
        protocol:"phi-release-publication-v1",
        publicationId:"release-pub-1",
        releaseId:pkg.releaseManifest.id,
        packageSha256,
        retrievalUrl:"https://public.example.test/releases/package.json",
        publishedAt:"2026-10-02T07:11:00.000Z"
      },
      publisherUrl:"https://publisher.example.test/publish",
      retrievalOrigin:"https://public.example.test",
      retrievedPackage:pkg
    }),
    /basis fingerprint does not match/i
  );
});
