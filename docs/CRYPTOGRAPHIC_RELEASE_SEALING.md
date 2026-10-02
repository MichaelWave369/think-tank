# Cryptographic Release Sealing

PR 25 adds optional Ed25519 signatures over governed PR 24 release manifests.

## Core law

**SIGNED RELEASE ≠ TRUSTED SIGNER ≠ TRUSTED TIME ≠ CONTENT TRUE.**

A verified release seal means one Ed25519 private key signed one exact release-manifest digest, the public key matches the recorded fingerprint, the release-specific envelope verifies, and the REL manifest has not changed since signing.

It does not establish real-world signer identity, signer authority outside Think Tank, trusted time, current release eligibility, factual truth, or synthesis correctness.

## Dedicated release signing key

Release sealing uses separate bridge configuration:

    RELEASE_SIGNING_PRIVATE_KEY_FILE=
    RELEASE_SIGNING_KEY_LABEL=release-bridge

Generate a keypair with:

    npm run release:keygen

Default output:

    .secrets/release-ed25519-private.pem
    .secrets/release-ed25519-public.pem

The private key is written with mode 0600. The release key is intentionally separate from the dossier-signing key.

## Separate signed domain

Dossier seals and release seals both use Ed25519, but they sign different envelopes.

The release envelope contains schemaVersion, releaseId, dossierId, algorithm, canonicalization, manifestSha256, publicKeyFingerprintSha256, signedAt, clock, signerLabel, and trust.

Fixed labels:
- algorithm: Ed25519
- canonicalization: json-stable-v1
- clock: untrusted-local-clock
- trust: self-attested-local-release-key

A release signature cannot be interpreted as a dossier signature.

## Manifest digest

The bridge computes SHA256(stableCanonicalJson(releaseManifest)).

That digest is stored as manifestSha256.

The REL manifest FNV replay fingerprint and this SHA-256 serve different purposes:
- FNV-1a is a deterministic replay checksum.
- SHA-256 is the cryptographic digest used for release sealing.

## Release seal receipt

DossierReleaseSealReceipt stores:
- seal id
- release id
- dossier id
- tool: ed25519-release-sealer
- algorithm: Ed25519
- canonicalization: json-stable-v1
- release manifest SHA-256
- public key PEM
- public-key SHA-256 fingerprint
- Ed25519 signature as Base64
- signed-at value
- untrusted-local-clock
- signer label
- self-attested-local-release-key

IDs have the form:

    RSEAL-<release-id>-<key-fingerprint-prefix>

One key may seal a given release manifest only once. Multiple distinct signer keys may seal the same release.

## Local clock

signedAt is included in the signed envelope so it cannot be altered without breaking the signature.

It is explicitly labeled untrusted-local-clock.

The signature proves integrity of the timestamp claim, not authoritative time. A future trusted-time extension can RFC 3161 timestamp a release-seal or release-manifest digest without redefining this field.

## Verification

Verification recomputes:
1. stable canonical REL manifest
2. manifest SHA-256
3. public-key fingerprint
4. release-specific signed envelope
5. Ed25519 signature verification

A changed manifest, key, fingerprint, envelope field, or signature fails verification.

## Verification receipt

A successful DossierReleaseSealVerificationReceipt stores:
- id: RVER-<release-seal-id>
- release id
- release-seal id
- tool: ed25519-release-verifier
- algorithm: Ed25519
- manifest SHA-256
- public-key fingerprint
- verified: true
- local verification time

Failed crypto verification does not create a successful verification receipt.

## Event flow

Sealing:
- dossier.release.seal.requested — operator
- dossier.release.seal.completed — tool
- dossier.release.seal.failed — tool

Verification:
- dossier.release.verify.requested — operator
- dossier.release.verify.completed — tool
- dossier.release.verify.failed — tool

## Kernel law

The kernel enforces:
- release-seal operations cannot mutate state during active governed execution
- sealing requires an existing REL manifest
- operator-only seal request
- tool-only seal completion/failure
- supported release-specific algorithm/canonicalization/clock/trust labels
- deterministic release-seal id
- SHA-256 and key-fingerprint shape
- public-key/signature/signer-label presence
- one accepted seal per release + signer key
- matching operator request
- one terminal result per request
- verification requires an existing release seal
- deterministic verification id
- exact release/seal/digest/fingerprint linkage
- successful verification only
- deterministic replay

Cryptographic SHA-256 and Ed25519 verification remain at the trusted local bridge boundary.

## Bridge routes

Bridge version advances to 0.10.0.

Routes:

    GET  /dossier/release/seal/status
    POST /dossier/release/seal
    POST /dossier/release/verify

## UI

After a REL manifest exists, the release panel adds a CRYPTOGRAPHIC RELEASE SEAL section.

States:
- NO RELEASE
- UNSEALED
- SEALED · UNVERIFIED
- VERIFIED

Actions:
- SEAL RELEASE
- VERIFY RELEASE SEAL

The panel displays the RSEAL id, REL manifest SHA-256, key fingerprint, algorithm/canonicalization, local signed-at value with untrusted-clock label, signer label, and verification state/time.

## Release-package export

EXPORT RELEASE PACKAGE includes:
- releaseManifest
- releaseSeals linked to that REL manifest
- releaseSealVerifications linked to those seals
- canonical artifacts named by releaseManifest.artifactIds

Release seals are intentionally not inserted into artifactIds. The REL manifest existed before its signatures. Signatures attest the manifest rather than becoming part of the manifest's own recursive artifact basis.

## Dossier export

TEAR / EXPORT DOSSIER also includes linked releaseManifests, releaseSeals, and releaseSealVerifications.

## Relationship to release authority

A REL manifest can exist without a release seal.

Release sealing is an integrity and portability layer above release authorization.

RELEASE AUTHORIZED ≠ RELEASE SIGNED ≠ RELEASE SIGNATURE VERIFIED.

Those are separate states and separate receipts.

## Non-goals

PR 25 does not change release eligibility, provenance assurance, synthesis governance, signer identity, signer reputation, or trusted time. It does not automatically seal releases, require a signature before package export, upload packages, or make a decision true.

## PR 26 trusted-time extension

PR 25 deliberately labels RSEAL signedAt as an untrusted local clock claim.

PR 26 adds trusted-time evidence without changing that field:

```
REL → RSEAL → RVER → RFC3161 RTSA
```

The RFC 3161 message imprint is SHA-256 of the complete stable-canonical RSEAL receipt. Therefore the TSA attests the existence time of the exact release-signature receipt, not merely the underlying REL manifest.

See [RFC 3161 Trusted Release Timestamp](RFC3161_RELEASE_TIMESTAMP.md).
