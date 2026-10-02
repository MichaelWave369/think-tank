# Release Availability Assurance Policy

PR 29 adds deterministic policy evaluation over release publication and durability evidence.

## Core law

**ASSURANCE MET ≠ CONTINUOUS UPTIME ≠ IMMUTABILITY ≠ ORIGIN INDEPENDENCE ≠ CONTENT TRUE.**

A successful RAVA report means the selected structural policy is satisfied by canonical RPUB and RAUD receipts for one exact release-package SHA-256.

It does not mean:
- the package was continuously available between observations
- the package will remain available in the future
- any host is immutable or append-only
- distinct origins are controlled by independent operators
- the publisher is trusted or endorses the content
- the release content is factually true

## Why a separate assurance report

RPUB and RAUD are evidence receipts.

RAVA is a deterministic interpretation layer over those receipts.

It creates no new network evidence.

The flow is:

    RPUB / RAUD evidence
      → operator selects policy
      → deterministic evaluator
      → RAVA report

This mirrors the earlier dossier provenance-assurance architecture:
- receipts remain receipts
- policy remains explicit
- policy evaluation is replayable
- no numeric trust score is invented

## Scope

Each RAVA report evaluates exactly:
- one REL release id
- one package SHA-256
- one selected policy
- every canonical RPUB for that REL + package SHA
- every successful RAUD linked to those RPUB receipts

Evidence for a different package SHA-256 does not affect the report.

This matters when a release package evolves after publication.

## Package-basis consistency

All RPUB receipts claiming the same release id + package SHA-256 must also agree on packageBasisFingerprint.

If they disagree, evaluation fails rather than silently combining contradictory canonical-basis metadata.

The package SHA-256 is the cryptographic identity of the externally published package.

The FNV package-basis fingerprint remains deterministic replay metadata.

## Policies

### Published

Requirements:
- verified-release-publication

Passes when at least one RPUB exists for the exact package SHA-256.

This is equivalent to:

> At least one public location successfully returned this exact package at publication time.

### Rechecked

Requirements:
- verified-release-publication
- successful-recheck

Passes when the exact package has at least one RPUB and at least one successful RAUD.

This means:

> The package was successfully published and was successfully retrieved again in a later operator-requested audit.

The local audit time is not trusted time.

### Repeated

Requirements:
- verified-release-publication
- multiple-rechecks

Passes when at least one RPUB has at least two successful RAUD receipts.

This is multiple repeat observations of one exact historical publication.

It does not prove uninterrupted availability between those observations.

### Multi-origin

Requirements:
- verified-release-publication
- multiple-retrieval-origins
- rechecked-each-origin

Passes when:
- the same exact package SHA-256 is represented by RPUB receipts on at least two distinct HTTPS retrieval origins
- at least two distinct origins each have a successful RAUD observation

An additional unaudited origin does not invalidate two already qualifying origins.

Distinct origins are topology evidence only.

They do not prove:
- different companies
- different machines
- different infrastructure providers
- different jurisdictions
- independent administrative control

### Resilient

Requirements:
- verified-release-publication
- multiple-retrieval-origins
- multiple-rechecks-each-origin

Passes when:
- the same exact package SHA-256 exists on at least two distinct HTTPS retrieval origins
- at least two origins each have a publication receipt with at least two successful RAUD observations

This is the strongest PR 29 policy.

It is still observation-based availability assurance, not permanence.

## Requirement kinds

ReleaseAvailabilityAssuranceRequirementKind:
- verified-release-publication
- successful-recheck
- multiple-rechecks
- multiple-retrieval-origins
- rechecked-each-origin
- multiple-rechecks-each-origin

Each requirement result stores:
- requirement
- satisfied
- exact evidenceIds

The report therefore explains why a policy passed or failed without producing a numeric trust score.

## Retrieval origins

Origins are derived from RPUB retrievalUrl using standard URL origin semantics.

For example:

    https://example.org/a/package.json
    https://example.org/b/package.json

count as one origin:

    https://example.org

while:

    https://a.example.org/package.json
    https://b.example.org/package.json

count as two origins.

Only credential-free HTTPS RPUB URLs are valid in the underlying publication receipts.

## RAVA report

DossierReleaseAvailabilityAssuranceReport stores:
- report id
- REL id
- package-basis fingerprint
- package SHA-256
- selected policy
- deterministic assurance-basis fingerprint
- package status: current or historical
- requirement results
- missing requirement kinds
- RPUB ids
- RAUD ids
- distinct retrieval origins
- per-publication origin + audit summary
- pass/fail result
- deterministic reason
- continuousAvailability: false
- immutabilityAuthority: false
- originIndependenceAuthority: false
- truthAuthority: false

IDs:

    RAVA-<REL-id>-<policy>-<basis-fingerprint>

## Basis fingerprint

The deterministic basis fingerprint covers:
- REL id
- package SHA-256
- package-basis fingerprint
- all matching RPUB receipts
- all matching successful RAUD receipts

A new matching RPUB or RAUD changes the basis and makes an older report stale.

Evidence for another package SHA does not stale the report.

## Package status

RAVA records:

    current
or
    historical

The evaluator compares the selected RPUB package-basis fingerprint with the current canonical release-package basis.

If they match, the package is current.

If the release later gains another RSEAL, RVER, or RTSA and its package basis changes, the older package remains valid historical evidence.

RAVA does not discard historical package assurance.

## Freshness

A RAVA report is fresh only while its basis fingerprint still matches canonical RPUB/RAUD evidence for its exact REL + package SHA-256.

Freshness changes when matching evidence changes.

Examples:
- another RAUD for the package → stale
- another RPUB for the package → stale
- unrelated package RPUB → unchanged
- unrelated release evidence → unchanged

Re-evaluation creates a new immutable report rather than modifying the old one.

## Governed events

- dossier.release.availability.requested — operator
- dossier.release.availability.completed — system

The kernel enforces:
- no availability assurance mutation during active governed execution
- operator-only request
- existing REL
- lowercase package SHA-256
- existing RPUB for that exact package
- supported policy
- system-only completion
- full deterministic recomputation
- no authority escalation
- unique report id per exact basis
- matching operator request
- one completion per request
- deterministic replay

## No bridge dependency

PR 29 does not add a bridge route.

It does not perform network access.

Bridge version remains:

    0.13.0

The evaluator can run offline from canonical ledger state.

## UI

The release panel adds:

    RELEASE AVAILABILITY ASSURANCE

Available policies:
- Published
- Rechecked
- Repeated
- Multi-origin
- Resilient

States:
- NOT EVALUATED
- POLICY SATISFIED
- POLICY NOT SATISFIED
- REPORT STALE

The report displays:
- RAVA id
- basis fingerprint
- package SHA-256
- current/historical package status
- retrieval-origin count
- RPUB count
- RAUD count
- freshness
- per-requirement MET/MISSING status
- exact evidence receipt ids
- deterministic reason
- explicit non-authority labels

## Export

TEAR / EXPORT DOSSIER includes:

    releaseAvailabilityAssurances

RAVA reports are not part of the governed release package.

They are post-publication policy receipts about external availability evidence.

## Relationship to the release chain

PR 29 extends the release provenance chain as:

    REL
      → RSEAL
      → RVER
      → optional RTSA
      → RPUB
      → RAUD observations
      → RAVA policy report

RAVA does not feed back into the original release authorization.

It does not rewrite:
- dossier outcome
- provenance assurance
- REL authorization
- RSEAL/RVER
- RTSA
- RPUB
- RAUD

## Non-goals

PR 29 does not:
- schedule future checks
- create background monitoring
- perform a network request
- prove continuous uptime
- create immutable storage
- prove distinct-origin operator independence
- establish publisher reputation
- rank publishers
- create trusted observation time
- change release authorization
- change synthesis governance
- make content true

## PR 30 identity-evidence relationship

PR 30 adds POID signed origin-identity claims above RPUB.

PR 30 intentionally does not modify RAVA requirements.

Existing Published / Rechecked / Repeated / Multi-origin / Resilient reports continue to mean exactly what PR 29 defined. In particular:

```
originIndependenceAuthority: false
```

remains unchanged.

POID evidence can support a later explicit identity-aware policy, but it does not retroactively upgrade URL-origin diversity into operator independence.

See [Publisher Origin Identity Attestation](PUBLISHER_ORIGIN_IDENTITY.md).
