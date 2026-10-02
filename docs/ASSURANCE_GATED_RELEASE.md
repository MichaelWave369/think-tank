# Assurance-Gated Release Manifest

PR 24 adds a separate governed release/export authority plane above PR 23 provenance assurance.

## Core law

**RELEASE AUTHORIZED ≠ SYNTHESIS AUTHORIZED ≠ CONTENT TRUE.**

A release manifest means:
- the operator explicitly requested release
- one specific accepted provenance assurance report existed
- that assurance report was fresh
- that assurance report passed the selected policy
- the system deterministically listed the canonical artifacts that justified release

It does not mean:
- the original synthesis was authorized
- a withheld synthesis becomes completed
- a human override disappears
- the underlying claims are true
- the release should be acted upon in the real world

## Why release is separate

Think Tank already separates:
- synthesis governance
- human override
- provenance evidence
- provenance assurance

PR 24 adds another separate question:

> Is this historical dossier package allowed through the governed release/export path under this provenance policy?

That release decision must not rewrite the original decision.

Example:

```
DOS-0042
NORMAL OUTCOME: WITHHELD

OVR-0043
HUMAN OVERRIDE: ACTION AUTHORIZED

ASSURE-DOS-0042-full-provenance-...
PROVENANCE POLICY: SATISFIED

REL-DOS-0042-full-provenance-...
RELEASE PACKAGE: AUTHORIZED
```

All four records remain distinct.

## Prerequisite

Release requires an already accepted DossierProvenanceAssuranceReport that is:
- for the same dossier
- for the requested policy
- `passed: true`
- `truthAuthority: false`
- fresh against the current linked provenance basis

A failed or stale assurance report cannot authorize release.

PR 24 does not silently run PR 23 assurance evaluation.

The operator evaluates assurance first, then separately authorizes release.

## Release manifest

DossierReleaseManifest stores:
- manifest id
- dossier id
- selected provenance policy
- assurance report id
- assurance basis fingerprint
- checkpoint id selected by assurance
- linked human override id, or empty string
- sorted unique artifact ids
- deterministic manifest fingerprint
- `releaseAuthority: "fresh-passing-provenance-policy"`
- `truthAuthority: false`

## Manifest id

Ids have the form:

```
REL-<dossier-id>-<policy>-<manifest fingerprint suffix>
```

## Manifest fingerprint

The manifest uses the repository's deterministic FNV-1a replay fingerprint convention.

Its basis includes:
- dossier id
- provenance policy
- assurance report id
- assurance basis fingerprint
- checkpoint id
- human override id when present
- sorted artifact ids
- release-authority label
- truthAuthority false

This fingerprint is deterministic replay metadata.

It is not a cryptographic signature and does not replace SHA-256 or Ed25519.

## Artifact list

The release artifact list is derived from:
- the decision dossier id
- linked human override id when present
- assurance report id
- every evidence id named by the assurance requirements

For example, an integrity release normally contains ids for:
- DOS-...
- ASSURE-...
- SEAL-...
- DVER-...
- TLOG-...
- CHK-...

A full-provenance release additionally includes the exact accepted:
- witness receipt
- witness verification
- RFC 3161 receipt
- external publication receipt

The list is sorted and deduplicated deterministically.

## Human override capture

If a dossier has a linked DecisionOverrideReceipt at release time, its id is included in:
- `operatorOverrideId`
- `artifactIds`

This does not change the underlying normal dossier outcome.

If a release was authorized before a later override exists, that historical release remains historical.

A later change that affects manifest construction makes the old manifest non-current.

## Event flow

Events:
- `dossier.release.requested` — operator
- `dossier.release.authorized` — system

There is no automatic release.

There is no release event sourced from a provider or remote tool.

## Kernel law

Release requests:
- cannot run during active governed execution
- must be operator-originated
- require an existing dossier
- require a supported provenance policy
- require an explicit assurance report id
- require that assurance to be fresh and passing
- reject duplicate dossier/policy/assurance release

Release authorization:
- must be system-originated
- requires the matching dossier/policy/assurance id
- deterministically rebuilds the complete manifest
- rejects any supplied manifest mismatch
- requires `truthAuthority: false`
- requires `releaseAuthority: fresh-passing-provenance-policy`
- rejects duplicate manifest ids
- requires a matching operator request
- supports exact deterministic replay

## No release-failed event

A stale, failed, unsupported, or missing assurance is not an external runtime failure.

It is an ineligible release request and is rejected by the kernel.

The UI therefore disables release authorization until the selected assurance is fresh and passing.

## Current vs historical release

A release manifest is CURRENT when deterministic reconstruction from its referenced assurance still produces the same manifest.

It becomes HISTORICAL when, for example:
- the assurance becomes stale because linked provenance changed
- a later human override changes the release artifact set
- the referenced assurance is no longer release-eligible

The historical manifest is never deleted or rewritten.

## UI flow

The Decision Dossier flow is:

```
EVALUATE ASSURANCE
  → POLICY SATISFIED
  → AUTHORIZE RELEASE
  → RELEASE AUTHORIZED
  → EXPORT RELEASE PACKAGE
```

If the assurance is failed or stale:

```
RELEASE BLOCKED
```

## Release package export

EXPORT RELEASE PACKAGE writes JSON:

```json
{
  "schemaVersion": 1,
  "releaseManifest": { "...": "REL manifest" },
  "artifacts": [
    { "...": "canonical artifact named by manifest.artifactIds" }
  ]
}
```

The package does not export arbitrary current state.

Every included canonical object must be named by the immutable manifest artifact list.

If an artifact id cannot be resolved, export fails instead of silently omitting it.

## Regular dossier export

TEAR / EXPORT DOSSIER remains available independently.

It is an inspection/archive operation.

PR 24 does not redefine every JSON download as a governed release.

The assurance-gated release package is the explicit controlled release path.

## Relationship to PR 23

PR 23 answers:

> Does this provenance policy currently pass?

PR 24 answers:

> Did the operator explicitly authorize a release package using this exact fresh passing assurance report?

Those are separate events and separate receipts.

## Non-goals

PR 24 does not:
- change Reality Gate
- change Claim Policy
- change Argument Policy
- authorize synthesis
- authorize real-world action
- convert human override into machine approval
- automatically run assurance
- automatically release anything
- add wall-clock time to release authorization
- cryptographically sign the release manifest
- upload the release package anywhere
- make provenance equivalent to truth
