# Argument-Map Governance

PR 16 turns PR 15 provider argument maps into an explicit synthesis requirement for selected rigorous modes.

## Core law

**FRESH + ACCEPTED ≠ TRUE.**

A fresh accepted argument map means:

> the human operator chose to preserve a Challenger reasoning artifact that still matches the current exact excerpt basis.

It does not mean:

> the claim is true.

## Three independent synthesis checks

PR 16 preserves three separate governance questions.

### Reality Gate

Did the evidence/provenance packet satisfy the numeric mode threshold?

### Claim Policy

Did the deterministic structural Challenger audit satisfy the selected mode?

### Argument Policy

Where exact excerpts exist, did the selected mode require a fresh human-accepted Challenger argument map, and was that requirement satisfied?

Passing one check does not imply passing the others.

## Frozen mode policy

| Mode | Argument policy |
| --- | --- |
| SOLO | informational |
| TRIO | informational |
| DREAM | informational |
| BUILD | informational |
| COUNCIL | fresh-accepted-on-excerpts |
| DEBATE | fresh-accepted-on-excerpts |
| AUDIT | fresh-accepted-on-excerpts |

PR 16 intentionally does not require argument maps in every mode.

## Applicability

Argument Policy applies only to claims that currently have at least one pinned exact excerpt on evidence bound to that claim.

A registered claim with no pinned excerpt basis is not manufactured into an argument-map requirement.

If no claims are applicable, the policy passes.

## Satisfaction

An applicable claim satisfies Argument Policy when at least one review is:

- status ACCEPTED
- not dismissed
- fresh against the current deterministic PR 15 argument basis

Older stale accepted reviews may remain in history.

If any newer or older ACCEPTED review is still fresh, the claim is satisfied.

## Failure classes

The deterministic ArgumentGovernanceReport distinguishes:

### MISSING ACCEPTED MAP

No active accepted map and no current fresh draft exists.

### DRAFT ONLY

A fresh provider DRAFT exists, but the operator has not accepted it.

### STALE ACCEPTED MAP

Accepted review history exists, but no accepted map matches the current claim/binding/excerpt basis.

These are workflow states, not factual judgments.

## Canonical receipt

Every normal synthesis resolution now carries an immutable ArgumentGovernanceReport:

- mode
- argument policy
- applicable claim ids
- fresh accepted claim ids
- missing accepted claim ids
- stale accepted claim ids
- draft-only claim ids
- pass/block
- reason

The receipt is part of canonical state and replay fingerprints.

## Kernel law

For every normal synthesis.completed or synthesis.withheld event:

1. kernel recomputes Claim Policy
2. kernel recomputes Argument Policy
3. event must carry both receipts
4. both supplied receipts must exactly match deterministic recomputation
5. scheduler composes:
   - timeout/fault law
   - mode objection law
   - numeric Reality Gate
   - Claim Policy
   - Argument Policy
6. synthesis kind, output label, and action authority must match

A forged argument-policy PASS is rejected.

## COUNCIL

When a Council claim has pinned exact excerpts, Council requires a fresh accepted map for that claim.

This preserves a human-approved record of how the exact excerpt basis was argued before Council synthesis is authorized.

## DEBATE

DEBATE already requires at least one logged objection.

PR 16 additionally requires a fresh accepted map for every excerpt-bearing applicable claim.

A transient spoken objection is therefore not the only preserved reasoning artifact when exact source text is involved.

## AUDIT

AUDIT now requires all existing PR 13 structural laws plus PR 16 Argument Policy.

For excerpt-bearing claims, a fresh accepted argument map is required.

This does not convert Challenger's provider prose into deterministic truth.

It requires that the provider reasoning artifact be current and explicitly human accepted.

## Informational modes

SOLO, TRIO, DREAM, and BUILD may still display:

- missing maps
- stale accepted maps
- draft-only maps

but those states do not block synthesis through Argument Policy.

Existing Reality Gate and Claim Policy laws still apply normally.

## Human override

FORCE SYNTHESIS remains available after a normal mode law withholds synthesis.

The override is:

- operator-originated
- explicit
- ledgered
- replayable

It does not rewrite the failed ArgumentGovernanceReport.

## Historical receipts

Accepting or dismissing an argument map does not rewrite a previously completed session.

The room may therefore show:

- LAST ARGUMENT RECEIPT: PASS
- ARGUMENT POLICY NOW: BLOCK

or the reverse.

The historical receipt explains the basis used by that completed run.

A future run evaluates current state again.

## No score laundering

Argument maps do not add points to Reality Gate.

An accepted map cannot compensate for:

- weak evidence
- missing structural audit
- stale structural audit
- insufficient AUDIT coverage
- missing DEBATE objection

The policy is conjunctive, not additive.

## Non-goals

PR 16 does not:

- score truth probability
- score source credibility
- alter Reality Gate weights
- alter claim binding relations
- auto-accept provider reviews
- require maps for claims without exact excerpts
- require maps in SOLO/TRIO/DREAM/BUILD
- remove FORCE SYNTHESIS
