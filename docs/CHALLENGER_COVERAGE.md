# Challenger Claim Coverage Audits

PR 12 adds deterministic structural review of the claim/evidence graph.

## Core law

**Coverage is not truth.**

Challenger review answers questions such as:

- how many evidence receipts are bound to this claim?
- are bindings support, contradiction, or context?
- how many bound receipts are machine-verified?
- how many are operator-attested?
- how many came through governed research lineage?
- is the evidence one-sided or contested?
- has the claim graph changed since the last audit?

It does not answer:

> Is the claim true?

## Deterministic review

PR 12 does not call a provider model to create the structural audit.

The operator requests a Challenger audit.

The ledger records:

`claim.review.requested`

The system deterministically evaluates the canonical graph and emits:

`claim.review.completed`

The event kernel recomputes the entire receipt and rejects forged values.

## Review receipt

Each immutable `ClaimReviewReceipt` stores:

- review id
- claim id
- review timestamp
- basis fingerprint
- coverage state
- bound evidence count
- support count
- contradiction count
- context count
- machine-verified count
- operator-attested count
- unverified count
- research-lineage count
- structural flags

## Coverage states

### UNBOUND

No evidence is bound.

### THIN

Exactly one bound evidence receipt provides directional support or contradiction.

### DIRECTIONAL

Multiple bound receipts exist, but directional evidence runs only one way.

Context may also exist.

### CONTESTED

At least one support binding and one contradiction binding exist.

This does not imply equal evidentiary strength.

### CONTEXT-ONLY

Bindings exist, but all are contextual.

## Structural flags

Possible flags include:

- `no-evidence`
- `single-source`
- `no-machine-verified`
- `no-research-lineage`
- `support-only`
- `contradiction-only`
- `mixed-direction`
- `context-only`

Flags are descriptive.

They are not penalties, rankings, or factual verdicts.

## Basis fingerprint

The review fingerprint covers the exact semantic/provenance basis available at review time:

- claim id/text
- active binding ids
- evidence ids
- binding relation
- binding note
- evidence verification class
- evidence kind
- evidence URI
- research candidate lineage
- machine retrieval SHA-256 when present
- pinned excerpt ids, offsets, projection digests, and excerpt digests

Review history itself is excluded from this fingerprint.

Therefore adding another review does not make an earlier review stale.

## Fresh vs stale

The current graph fingerprint is compared with the stored review fingerprint.

If they match:

`FRESH`

If evidence or bindings change:

`STALE`

The old review remains in the ledger unchanged.

The operator may request a new audit.

## Request integrity

Review may run only while the room is:

- intake
- complete
- aborted

The request must be:

- operator-originated
- scoped to the Challenger cognitive role
- attached to an existing claim

The completion must be:

- system-originated
- Challenger-scoped
- attached to the same claim
- tied to a real unresolved request
- deterministically identical to kernel recomputation

If the claim/evidence graph changes between request and completion, the completion is rejected and a fresh audit must be requested.

## Reality Gate behavior

PR 12 does **not** change Reality Gate scoring, caps, or action authorization.

Creating a review does not:

- change Gate score
- invalidate Gate authorization
- add evidence
- alter claim bindings
- authorize action

PR 13 now consumes review freshness as explicit mode policy.

The review receipt itself remains observational and immutable. The later synthesis decision decides whether the selected mode requires that review to be fresh.

AUDIT additionally blocks UNBOUND / THIN claim coverage.

See [CLAIM_GOVERNANCE.md](CLAIM_GOVERNANCE.md).

## UI

The Challenger Claim Coverage Matrix displays:

- current live coverage state
- support / contradiction / context counts
- provenance counts
- research lineage count
- structural flags
- latest review id
- review basis fingerprint
- FRESH / STALE / UNREVIEWED status
- RUN CHALLENGER AUDIT control

The matrix shows both:

1. current live structure
2. last immutable review snapshot status

## Non-goals

PR 12 does not:

- score source credibility
- rank claims
- declare claims true/false
- compare political or ideological viewpoints
- ask a provider model to judge evidence quality
- change Reality Gate weights
- automatically search for missing evidence

Those require separate, explicit policy or research rungs.


## Excerpt-aware freshness

PR 14 includes pinned source excerpts in the review basis fingerprint.

Adding or removing an excerpt attached to evidence bound to a claim therefore makes the prior Challenger audit stale.

The historical audit remains immutable.

See [SOURCE_EXCERPTS.md](SOURCE_EXCERPTS.md).
