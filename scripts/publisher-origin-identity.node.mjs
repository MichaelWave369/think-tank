import test from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign
} from "node:crypto";
import {
  buildPublisherOriginIdentityReceipt,
  buildReleasePublicationReceipt,
  publisherOriginIdentityEnvelopeFor,
  releasePackageBasisFingerprintBridge,
  sealReleaseWithPrivateKey,
  stableCanonicalJson,
  verifyPublisherOriginIdentityDescriptor
} from "./provider-bridge.mjs";

const publicFingerprint=(publicKey)=>{
  const der=publicKey.export({type:"spki",format:"der"});
  return createHash("sha256").update(der).digest("hex");
};

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
  const privatePem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
  const seal=sealReleaseWithPrivateKey(
    manifest,
    privatePem,
    "release-test",
    "2026-10-02T13:00:00.000Z"
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
      verifiedAt:"2026-10-02T13:00:01.000Z"
    }],
    releaseRfc3161Timestamps:[],
    artifacts:[]
  };
};

const publicationFor=(pkg)=>{
  const packageBasisFingerprint=releasePackageBasisFingerprintBridge(pkg);
  const packageSha256=createHash("sha256")
    .update(stableCanonicalJson(pkg),"utf8")
    .digest("hex");
  return buildReleasePublicationReceipt({
    packageValue:pkg,
    packageBasisFingerprint,
    publisherResponse:{
      protocol:"phi-release-publication-v1",
      publicationId:"pub-1",
      releaseId:pkg.releaseManifest.id,
      packageSha256,
      retrievalUrl:"https://public.example.test/releases/pkg.json",
      publishedAt:"2026-10-02T13:01:00.000Z"
    },
    publisherUrl:"https://publisher.example.test/publish",
    retrievalOrigin:"https://public.example.test",
    retrievedPackage:pkg,
    retrievalVerifiedAt:"2026-10-02T13:01:01.000Z"
  });
};

const signedDescriptor=(overrides={})=>{
  const {privateKey,publicKey}=generateKeyPairSync("ed25519");
  const publicKeyPem=publicKey.export({type:"spki",format:"pem"}).toString();
  const base={
    schemaVersion:1,
    protocol:"phi-publisher-identity-v1",
    origin:"https://public.example.test",
    publisherId:"publisher-example",
    publisherLabel:"Example Publisher",
    administrativeDomainClaim:"example-publishing-admin",
    publicKeyPem,
    publicKeyFingerprintSha256:publicFingerprint(publicKey),
    claimedAt:"2026-10-02T13:02:00.000Z",
    ...overrides
  };
  const envelope=publisherOriginIdentityEnvelopeFor(base);
  const signatureBase64=cryptoSign(
    null,
    Buffer.from(stableCanonicalJson(envelope),"utf8"),
    privateKey
  ).toString("base64");
  return {...base,signatureBase64};
};

test("verifies signed phi-publisher-identity-v1 descriptor for exact origin",()=>{
  const descriptor=signedDescriptor();
  const verified=verifyPublisherOriginIdentityDescriptor(
    descriptor,
    "https://public.example.test"
  );

  assert.equal(verified.publisherId,"publisher-example");
  assert.equal(verified.administrativeDomainClaim,"example-publishing-admin");
  assert.equal(verified.origin,"https://public.example.test");
});

test("rejects descriptor served for a different RPUB origin",()=>{
  const descriptor=signedDescriptor();

  assert.throws(
    ()=>verifyPublisherOriginIdentityDescriptor(
      descriptor,
      "https://other.example.test"
    ),
    /incomplete or malformed/i
  );
});

test("rejects descriptor tampering after signature",()=>{
  const descriptor=signedDescriptor();
  const tampered={...descriptor,publisherLabel:"Tampered Publisher"};

  assert.throws(
    ()=>verifyPublisherOriginIdentityDescriptor(
      tampered,
      "https://public.example.test"
    ),
    /signature is invalid/i
  );
});

test("rejects public-key fingerprint mismatch",()=>{
  const descriptor=signedDescriptor({
    publicKeyFingerprintSha256:"0".repeat(64)
  });

  assert.throws(
    ()=>verifyPublisherOriginIdentityDescriptor(
      descriptor,
      "https://public.example.test"
    ),
    /fingerprint does not match/i
  );
});

test("builds POID bound to exact historical RPUB and fixed well-known URL",()=>{
  const pkg=packageValue();
  const publication=publicationFor(pkg);
  const descriptor=signedDescriptor();
  const receipt=buildPublisherOriginIdentityReceipt({
    packageValue:pkg,
    publication,
    descriptor,
    identityUrl:"https://public.example.test/.well-known/phi-publisher-identity.json",
    verifiedAt:"2026-10-02T13:03:00.000Z"
  });

  assert.equal(receipt.releaseId,publication.releaseId);
  assert.equal(receipt.publicationReceiptId,publication.id);
  assert.equal(receipt.retrievalOrigin,"https://public.example.test");
  assert.equal(
    receipt.identityUrl,
    "https://public.example.test/.well-known/phi-publisher-identity.json"
  );
  assert.equal(receipt.verified,true);
  assert.equal(receipt.realWorldIdentityAuthority,false);
  assert.equal(receipt.operatorIndependenceAuthority,false);
  assert.equal(receipt.truthAuthority,false);
  assert.equal(receipt.id,"POID-"+publication.id+"-"+receipt.receiptSha256.slice(0,12));
});

test("rejects arbitrary identity URL even with a valid descriptor",()=>{
  const pkg=packageValue();
  const publication=publicationFor(pkg);
  const descriptor=signedDescriptor();

  assert.throws(
    ()=>buildPublisherOriginIdentityReceipt({
      packageValue:pkg,
      publication,
      descriptor,
      identityUrl:"https://identity.example.test/phi.json"
    }),
    /does not match the RPUB retrieval origin/i
  );
});
