# Verified External Release Publication

PR 27 adds verified external publication for governed release packages.

## Core law

**PUBLISHED RELEASE ≠ IMMUTABLE ≠ ENDORSED ≠ CONTENT TRUE.**

A successful RPUB receipt means:
- a governed REL manifest existed
- the canonical release package contained at least one successfully verified RSEAL
- the operator explicitly requested publication of one pinned package basis
- the local bridge independently validated the complete package
- the bridge POSTed that exact package to a configured HTTPS publisher
- the publisher returned a constrained phi-release-publication-v1 response
- the bridge independently GET-read the public retrieval URL
- the retrieved JSON exactly matched the original stable-canonical package
- the accepted RPUB receipt still matched the package basis pinned by canonical state

It does not mean:
- the publisher is permanent
- the publication endpoint is append-only
- the publisher endorses the release
- the publisher's claimed time is trusted time
- the signer has a verified real-world identity
- the dossier or release is factually true

## Required release state

External release publication requires:
- existing REL manifest
- at least one RSEAL
- at least one successful RVER linked to an RSEAL

RFC 3161 RTSA is optional.

If RTSA receipts exist, they are included in the package and therefore in the published package SHA-256.

## Canonical release package

PR 27 centralizes package construction in one pure domain builder.

The package contains:

    {
      schemaVersion: 1,
      releaseManifest,
      releaseSeals,
      releaseSealVerifications,
      releaseRfc3161Timestamps,
      artifacts
    }

releaseSeals, releaseSealVerifications, and releaseRfc3161Timestamps are sorted by id.

artifacts are resolved in the exact order of releaseManifest.artifactIds.

Manual EXPORT RELEASE PACKAGE and external publication use this same builder.

## Package basis fingerprint

Before publication the operator request pins:

    fnv1a32(stableCanonicalJson(releasePackage))

The browser sends both:
- releasePackage
- packageBasisFingerprint

The bridge independently recomputes the same FNV-1a fingerprint from the full received package and rejects a mismatch.

The kernel independently recomputes the package basis from canonical state before accepting the RPUB completion.

This closes the gap where modified artifact contents might otherwise be published while reusing legitimate ids.

The FNV fingerprint is deterministic replay metadata, not a cryptographic digest.

## Package SHA-256

The bridge also computes:

    SHA256(stableCanonicalJson(releasePackage))

This is stored in RPUB as packageSha256.

The package SHA-256 is the cryptographic digest of the complete externally published object.

## Configuration

Release publication is disabled unless configured:

    RELEASE_PUBLISH_URL=

Optional exact public retrieval origin:

    RELEASE_PUBLISH_RETRIEVAL_ORIGIN=

If omitted, the publisher URL origin is used.

Optional server-side publisher credential:

    RELEASE_PUBLISH_BEARER_TOKEN=

Maximum release package bytes:

    RELEASE_PUBLISH_MAX_BYTES=2000000

The bearer token:
- remains in the local bridge
- is sent only to RELEASE_PUBLISH_URL
- is never returned to the browser
- is never stored in canonical state
- is never sent to the public retrieval URL

## Protocol

Protocol identifier:

    phi-release-publication-v1

### Request

The bridge POSTs stable-canonical JSON:

    {
      "protocol": "phi-release-publication-v1",
      "packageBasisFingerprint": "fnv1a32:...",
      "packageSha256": "...",
      "releasePackage": { "...": "canonical package" }
    }

The request uses:
- HTTPS
- application/json
- optional Authorization bearer token
- validated and pinned public-network destination
- no redirects

### Publisher response

The publisher returns JSON:

    {
      "protocol": "phi-release-publication-v1",
      "publicationId": "publisher-defined-id",
      "releaseId": "REL-...",
      "packageSha256": "...",
      "retrievalUrl": "https://public.example.org/releases/REL-....json",
      "publishedAt": "2026-10-02T08:00:00.000Z"
    }

Requirements:
- exact protocol
- exact REL id
- exact package SHA-256
- non-empty publication id
- parseable publishedAt
- credential-free HTTPS retrieval URL
- no fragment
- retrieval origin equals configured retrieval origin

publishedAt remains a publisher claim.

Use RTSA for trusted release-time semantics.

## Public read-back

A successful POST response is not sufficient.

The bridge performs a second public GET:
- no publisher bearer token
- HTTPS only
- validated/pinned public destination
- no redirects
- byte-limited response
- application/json required
- JSON parse required
- full package validation repeated
- exact stable-canonical equality required

Any content change fails publication.

## Package validation at bridge boundary

Before publishing and after read-back, the bridge validates:
- package shape and schema version
- REL manifest presence
- artifact ids exactly match releaseManifest.artifactIds
- every RSEAL belongs to the REL manifest
- every RSEAL cryptographically verifies against the REL manifest
- every RVER exactly links to an included RSEAL
- at least one successful RVER exists
- every RTSA links to an included RSEAL with matching manifest digest and key fingerprint

The bridge does not promote RTSA presence to a publication prerequisite.

## RPUB receipt

DossierReleasePublicationReceipt stores:
- receipt id
- REL id
- tool: verified-release-package-publisher
- protocol: phi-release-publication-v1
- deterministic package-basis fingerprint
- REL manifest SHA-256
- complete package SHA-256
- publisher URL
- retrieval URL
- publisher publication id
- publisher-claimed time
- retrieval HTTP status
- retrieval content type
- local read-back verification time
- exact included RSEAL ids
- exact included RVER ids
- exact included RTSA ids
- exact REL artifact ids
- receipt SHA-256
- externally-retrieved-release-publication

IDs:

    RPUB-<REL-id>-<receipt-sha256-prefix>

## Receipt SHA-256

receiptSha256 covers the complete receipt basis except its derived id.

It includes the package linkage, URLs, publication id, claimed time, read-back metadata, included receipt-id lists, and trust label.

## Governed events

- dossier.release.publication.requested — operator
- dossier.release.publication.completed — tool
- dossier.release.publication.failed — tool

The operator request pins dossierReleasePackageFingerprint.

The kernel enforces:
- no publication during active governed execution
- operator-only request
- existing REL manifest
- verified RSEAL prerequisite
- requested package fingerprint equals canonical package basis
- tool-only completion/failure
- completion package fingerprint still equals canonical state
- exact RSEAL / RVER / RTSA / artifact id lists
- manifest digest linked to a verified included RSEAL
- HTTPS URL shape
- application/json successful read-back
- deterministic RPUB id
- one accepted publication per REL + publisher URL + package basis
- matching pinned request
- deterministic replay

## Package changes during publication

If canonical release-package state changes after the operator request and before completion, the completion is rejected.

Examples:
- new RSEAL added
- new RVER added
- new RTSA added

The operator must publish the new package basis explicitly.

## Multiple publishers

The same exact package may be published through multiple configured publisher URLs over time.

The same REL + publisher URL + package basis may only yield one accepted RPUB.

If the package basis later changes, that new package can be published again through the same publisher.

## RPUB is not recursively included

RPUB receipts are deliberately not part of the release package being published.

Otherwise accepting a publication receipt would change the package that the receipt claims to have published.

RPUB is an external attestation about the package, not part of the package's own recursive basis.

Dossier export includes RPUB receipts separately.

## UI

The release panel adds EXTERNAL RELEASE PUBLICATION.

States:
- VERIFIED RELEASE SEAL REQUIRED
- PUBLISHER READY
- PUBLISHER DISABLED
- PUBLISHER ERROR
- PUBLISHED · READ-BACK VERIFIED

Action:

    PUBLISH + VERIFY RELEASE

The UI displays:
- RPUB id
- package-basis fingerprint
- package SHA-256
- REL manifest SHA-256
- publication id
- publisher URL
- public retrieval URL
- publisher-claimed time
- local read-back verification time
- RPUB receipt SHA-256

## Bridge

Bridge version advances to 0.12.0.

Routes:

    GET  /dossier/release/publication/status
    POST /dossier/release/publication

## Non-goals

PR 27 does not:
- make publication permanent
- create append-only public storage
- establish publisher reputation
- treat publisher time as trusted time
- identify the release signer
- require RTSA
- change assurance
- change release authorization
- change synthesis governance
- automatically publish anything
- make content true

## PR 28 durability extension

PR 27 proves one successful publication + exact public read-back.

PR 28 can later reconstruct that exact historical RPUB package and repeat the public retrieval without using publisher credentials.

The extended path is:

```
RPUB
  → RAUD-1
  → RAUD-2
  → RAUD-3
```

Each RAUD is a distinct observation that the exact RPUB package remained publicly retrievable at that check.

RAUD does not become part of the published package and therefore does not mutate the package basis it audits.

See [Release Publication Durability Audit](RELEASE_DURABILITY.md).

## PR 29 assurance relationship

PR 29 can evaluate one exact RPUB package SHA-256 across all canonical RPUB and RAUD receipts for that package.

The RAVA layer is deterministic and offline. It does not change RPUB and does not contact any publisher.

Multiple distinct retrieval origins may satisfy multi-origin requirements, but distinct URL origins do not establish independent operator control.

See [Release Availability Assurance Policy](RELEASE_AVAILABILITY_ASSURANCE.md).

## PR 30 publisher-origin identity relationship

PR 30 can derive the retrieval origin from any historical RPUB and fetch:

```
<retrieval-origin>/.well-known/phi-publisher-identity.json
```

The descriptor is self-signed with an Ed25519 origin identity key and becomes a separate POID receipt after verification.

POID does not enter the release package and does not change RPUB semantics.

A valid origin signature proves a key-backed claim served by that origin, not legal identity or independent administration.

See [Publisher Origin Identity Attestation](PUBLISHER_ORIGIN_IDENTITY.md).
