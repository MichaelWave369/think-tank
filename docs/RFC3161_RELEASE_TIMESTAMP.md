# RFC 3161 Trusted Release Timestamp

PR 26 extends the existing RFC 3161 trust boundary from portable checkpoints to verified cryptographic release seals.

## Core law

**RFC3161 RELEASE TIME VERIFIED ≠ TRUSTED SIGNER IDENTITY ≠ CONTENT TRUE.**

A successful release timestamp receipt means:
- the REL manifest existed
- an RSEAL receipt existed for that REL manifest
- that RSEAL had already been successfully verified by Think Tank
- the bridge independently re-verified the REL + RSEAL cryptography
- SHA-256 of the complete RSEAL receipt was used as the RFC 3161 message imprint
- the returned token verified under the operator-configured RFC 3161 trust-anchor file
- the TSA generation time and metadata were retained with the raw token

It does not mean:
- the release signer has a verified real-world identity
- every third party trusts the configured TSA root
- the TSA is universally authoritative
- the underlying dossier is factually true
- the synthesis or release decision was correct

## Why timestamp the RSEAL receipt

PR 25 records a local signedAt claim inside the Ed25519 release envelope.

That value is intentionally labeled untrusted-local-clock.

PR 26 does not replace or reinterpret signedAt.

Instead it timestamps:

    SHA256(stableCanonicalJson(DossierReleaseSealReceipt))

This proves that the exact signed-release receipt existed no later than the TSA generation time accepted under the configured trust chain.

Timestamping only the REL manifest would prove the manifest existed, but not that the release signature itself already existed.

## Required chain

The governed path is:

    REL
      → RSEAL
      → RVER
      → RFC3161 RELEASE TIMESTAMP

Think Tank will not request trusted release time before a successful RVER receipt exists.

The bridge also re-verifies the REL manifest against the RSEAL before it sends any timestamp query.

## Configuration

PR 26 reuses the existing RFC 3161 configuration:

    RFC3161_TSA_URL=
    RFC3161_TSA_CA_FILE=
    RFC3161_OPENSSL_BIN=openssl

No separate release-time TSA configuration is introduced.

The same operator-selected trust boundary applies to checkpoint and release-seal timestamping.

## Request flow

The bridge:
1. receives REL manifest + RSEAL
2. verifies the RSEAL against the REL manifest
3. stable-canonicalizes the complete RSEAL receipt
4. computes SHA-256
5. creates an RFC 3161 query with that digest
6. POSTs the query to the configured TSA
7. verifies the reply with OpenSSL and the configured CA file
8. extracts TSA metadata
9. stores the raw token and exact RSEAL linkage

The REL manifest and RSEAL are not sent to the TSA. Only the RFC 3161 query containing the message imprint is sent.

## Receipt

DossierReleaseRfc3161TimestampReceipt stores:
- receipt id
- release id
- RSEAL id
- tool: rfc3161-release-seal-timestamp-verifier
- standard: RFC3161
- hash algorithm: SHA-256
- SHA-256 of the complete RSEAL receipt
- REL manifest SHA-256
- release signer public-key fingerprint
- raw timestamp token SHA-256
- raw timestamp token as Base64
- TSA policy OID
- TSA serial number
- TSA generation time
- TSA subject
- configured TSA URL
- configured trust-anchor file SHA-256
- local verification time
- configured-rfc3161-trust-anchor

Receipt IDs:

    RTSA-<RSEAL-id>-<token-sha256-prefix>

## Time semantics

Three different time values may now exist around a release:

- RSEAL signedAt: signed local clock claim, integrity protected but not authoritative
- RTSA genTime: TSA generation time authenticated under the configured RFC 3161 trust chain
- RTSA verifiedAt: local time when Think Tank completed token verification

Only genTime carries RFC 3161 trusted-time semantics.

Even genTime is scoped to the configured trust anchor. It is not declared universally trusted.

## Duplicate policy

One RSEAL may carry multiple RFC 3161 receipts when the authority URL or trust-anchor digest differs.

The same RSEAL + authority URL + trust-anchor digest may only be accepted once.

This supports deliberate trust-root or TSA changes without allowing duplicate receipts to inflate provenance.

## Governed events

- dossier.release.timestamp.requested — operator
- dossier.release.timestamp.completed — tool
- dossier.release.timestamp.failed — tool

The kernel enforces:
- no release timestamp mutation during active governed execution
- operator-only request
- existing RSEAL
- successful existing RVER prerequisite
- tool-only completion/failure
- release/RSEAL linkage
- RFC 3161 labels
- RSEAL manifest digest linkage
- signer-key fingerprint linkage
- SHA-256 field shapes
- timestamp metadata and authority URL shape
- deterministic RTSA id
- duplicate authority/trust-anchor rejection
- matching request
- one terminal result per request
- deterministic replay

The cryptographic RSEAL SHA-256 and RFC 3161 verification work remain at the local Node/OpenSSL bridge boundary.

## Bridge

Bridge version advances to 0.11.0.

New route:

    POST /dossier/release/timestamp

The existing status route remains authoritative for both timestamp surfaces:

    GET /dossier/timestamp/status

## UI

The release panel adds TRUSTED RELEASE TIME.

States:
- VERIFIED RELEASE SEAL REQUIRED
- TSA READY
- TSA DISABLED
- TSA ERROR
- RFC3161 VERIFIED

Action:

    REQUEST TRUSTED RELEASE TIME

The UI shows:
- RTSA id
- RSEAL SHA-256
- REL manifest SHA-256
- release signer key fingerprint
- TSA generation time
- token SHA-256
- TSA policy OID
- serial
- TSA subject
- authority URL
- trust-anchor SHA-256
- local verification time

## Export

Release-package export includes linked:

    releaseRfc3161Timestamps

Dossier export includes the same receipts.

The raw Base64 timestamp token is retained so future independent tools do not need to trust Think Tank's original metadata parsing.

## Relationship to checkpoint timestamps

Checkpoint RFC 3161 receipts answer:

> when did this portable transparency checkpoint exist?

Release RFC 3161 receipts answer:

> when did this exact verified release-signature receipt exist?

They share the same RFC 3161 verifier and configured trust boundary but remain different receipt types and event flows.

## Non-goals

PR 26 does not:
- identify the release signer
- rank signer trust
- choose a globally trusted TSA
- automatically timestamp every release
- make trusted time a release prerequisite
- alter provenance assurance
- alter release authorization
- alter synthesis governance
- make release content true
