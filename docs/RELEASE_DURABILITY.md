# Release Publication Durability Audit

PR 28 adds repeat external retrieval checks for previously accepted RPUB release-publication receipts.

## Core law

**AVAILABLE AGAIN ≠ PERMANENT ≠ IMMUTABLE ≠ CONTENT TRUE.**

A successful RAUD receipt means:
- a historical RPUB receipt already existed
- Think Tank reconstructed the exact historical release package named by that RPUB
- the local bridge independently revalidated the RPUB against that package
- the bridge performed a fresh credential-free HTTPS GET to the RPUB retrieval URL
- the retrieved package still validated as a governed release package
- stable-canonical JSON still matched the exact historical package
- the fresh read-back SHA-256 still matched the RPUB package SHA-256
- the result was recorded as a new canonical RAUD receipt

It does not mean:
- the package was continuously available between checks
- the package will remain available after the check
- the publisher is append-only
- the publisher is immutable
- the publisher is trusted or endorsed
- the local audit time is trusted time
- the release content is factually true

## Why a separate audit receipt

RPUB proves one successful publication + public read-back event.

It does not prove durability over time.

PR 28 therefore records repeat availability observations as separate RAUD receipts.

Each RAUD answers one narrow question:

> At this check, could Think Tank retrieve the exact historical package named by this RPUB again?

Repeated RAUD receipts provide a sequence of availability observations.

They still do not prove uninterrupted availability between those observations.

## Historical package reconstruction

A release can evolve after publication.

For example:

    RPUB-A package:
      REL
      RSEAL-1
      RVER-1

Later canonical state may contain:

    REL
    RSEAL-1
    RVER-1
    RTSA-1
    RSEAL-2
    RVER-2

Auditing RPUB-A must not silently audit the newer package.

PR 28 reconstructs the historical RPUB package from the exact ids frozen in that RPUB:
- releaseSealIds
- releaseVerificationIds
- releaseTimestampIds
- artifactIds

The reconstruction also requires the original package-basis fingerprint to recompute exactly.

Therefore RAUD remains meaningful even after the current release package changes.

## No current publisher configuration required

RAUD does not call the configured publisher POST endpoint.

It uses only the public retrieval URL already frozen inside RPUB.

Therefore an audit can still run when:
- RELEASE_PUBLISH_URL is later removed
- the original publisher bearer token is unavailable
- the publishing service itself is disabled

The audit only depends on the public retrieval location still being reachable.

## Network boundary

The durability audit GET uses the same public-network restrictions as verified publication:
- HTTPS only
- no embedded credentials
- no fragment
- public DNS/IP validation
- private/loopback/link-local/reserved addresses rejected
- validated destination address pinned for the request
- no redirects
- no authorization header
- application/json required
- configured release-package byte limit enforced

No publisher bearer token is ever sent during RAUD.

## Bridge revalidation

Before network access the bridge independently verifies:
- RPUB tool/protocol/trust labels
- deterministic RPUB id
- release id
- package-basis fingerprint
- release manifest SHA-256
- complete package SHA-256
- exact RSEAL ids
- exact RVER ids
- exact RTSA ids
- exact artifact ids
- credential-free HTTPS retrieval URL
- every RSEAL cryptographically verifies
- every RVER links correctly
- every RTSA links correctly
- at least one successful RVER exists

A browser cannot substitute a different historical package or a forged RPUB and rely on the kernel to reject it later.

## Read-back verification

After GET, the bridge:
1. requires a successful 2xx response
2. requires application/json
3. parses JSON
4. validates the retrieved governed release package
5. requires exact stable-canonical equality with the historical RPUB package
6. computes SHA-256 of the retrieved package
7. requires that digest to equal RPUB packageSha256

Only then may RAUD be emitted.

## RAUD receipt

DossierReleasePublicationAuditReceipt stores:
- RAUD id
- REL id
- RPUB id
- RPUB receipt SHA-256
- tool: release-publication-durability-auditor
- protocol: phi-release-publication-audit-v1
- package-basis fingerprint
- package SHA-256
- public retrieval URL
- retrieval HTTP status
- retrieval content type
- local checkedAt
- clock: untrusted-local-clock
- fresh read-back SHA-256
- exactMatch: true
- RAUD receipt SHA-256
- trust: repeat-external-retrieval

IDs:

    RAUD-<RPUB-id>-<receipt-sha256-prefix>

## Time semantics

checkedAt records when the local bridge performed the successful repeat retrieval.

It is explicitly labeled:

    untrusted-local-clock

RAUD does not create trusted-time semantics.

If trusted time for a release signature is required, use RTSA.

A future extension could trusted-time-attest an RAUD receipt, but PR 28 does not do so.

## Repeated audits

Multiple RAUD receipts for the same RPUB are intentionally allowed.

Each audit requires a fresh operator request.

A new checkedAt value changes the RAUD receipt basis and therefore its receipt SHA-256/id.

Example:

    RPUB-A
      → RAUD-A1
      → RAUD-A2
      → RAUD-A3

This is not duplicate inflation.

Each RAUD is a distinct availability observation.

## Governed events

- dossier.release.publication.audit.requested — operator
- dossier.release.publication.audit.completed — tool
- dossier.release.publication.audit.failed — tool

The kernel enforces:
- no durability audit during active governed execution
- operator-only request
- existing RPUB requirement
- event REL id must match RPUB REL id
- historical package must reconstruct exactly
- tool-only completion/failure
- exact RPUB id + receipt-SHA linkage
- exact package-basis fingerprint
- exact package SHA-256
- exact retrieval URL
- successful application/json status
- fresh read-back SHA-256 equals RPUB package SHA-256
- exactMatch must be true
- explicit local-clock/trust labels
- deterministic RAUD id
- unique RAUD id
- matching operator request
- one terminal result per request
- deterministic replay

## UI

The release panel adds:

    PUBLICATION DURABILITY

States:
- RPUB REQUIRED
- NOT RECHECKED
- AVAILABLE AGAIN · EXACT

The panel shows:
- successful recheck count
- latest RAUD id
- RPUB id
- package SHA-256
- fresh read-back SHA-256
- retrieval URL
- local checkedAt + untrusted clock label
- RAUD receipt SHA-256

Action:

    AUDIT PUBLICATION NOW

The action works even when the current publisher configuration is disabled.

## Export

TEAR / EXPORT DOSSIER includes:

    releasePublicationAudits

RAUD receipts are not inserted into the governed release package.

Like RPUB, they are external provenance evidence about the package rather than part of the package's recursive basis.

## Bridge

Bridge version advances to 0.13.0.

New route:

    POST /dossier/release/publication/audit

No new environment variables are required.

The route reuses:
- RELEASE_PUBLISH_MAX_BYTES
- existing public-network validation
- existing pinned HTTPS request logic
- governed release-package validation

## Relationship to RPUB

RPUB answers:

> Was this exact governed package published and publicly retrieved successfully?

RAUD answers:

> Can that exact historical package still be publicly retrieved now?

Neither proves:

> Will it always remain available?

## Non-goals

PR 28 does not:
- create background monitoring
- schedule recurring audits
- prove continuous uptime
- guarantee future availability
- create immutable storage
- establish publisher reputation
- trust local audit time
- modify release authorization
- modify assurance
- modify synthesis governance
- make content true

## PR 29 policy extension

PR 28 records individual repeat retrieval observations as RAUD receipts.

PR 29 adds a separate deterministic RAVA policy layer above those observations:

```
RPUB
  → RAUD observations
  → RAVA availability policy
```

RAVA does not create a network observation. It evaluates canonical RPUB/RAUD evidence already present in the ledger.

Available profiles range from one verified publication through repeated and multi-origin observations.

Even the strongest Resilient policy explicitly refuses continuous-availability, immutability, origin-independence, and truth authority.

See [Release Availability Assurance Policy](RELEASE_AVAILABILITY_ASSURANCE.md).
