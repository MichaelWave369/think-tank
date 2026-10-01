# Claim Registry + Claim-to-Source Binding

PR 10 adds a replayable semantic graph between claims and evidence.

## Why this rung exists

PR 8 established evidence quality/provenance scoring.

PR 9 established machine-verifiable retrieval provenance.

Neither answers:

> What exact proposition does this evidence bear on?

PR 10 makes that relationship explicit before automatic research/search is introduced.

## Claim model

Claims are operator-authored propositions.

A claim contains:

- claim id
- claim text
- `addedBy: operator`

PR 10 does not let providers or tools silently create canonical claims.

That can be added later under explicit policy.

## Binding model

Each source binding contains:

- binding id
- claim id
- evidence id
- relation
- optional note
- `addedBy: operator`

Relations are:

- `supports`
- `contradicts`
- `context`

These labels describe the operator's declared relationship between a source and a claim.

They do not certify truth.

## Derived claim status

Claim status is computed from current bindings.

The operator cannot directly set it.

### UNBOUND

No evidence bindings.

### SUPPORTED

At least one `supports` binding and no `contradicts` binding.

### CHALLENGED

At least one `contradicts` binding and no `supports` binding.

### CONTESTED

At least one support and at least one contradiction.

### CONTEXT-ONLY

At least one context binding and no directional support/contradiction.

These statuses are descriptive graph states, not factual verdicts.

## Deletion law

No silent cascade deletion is allowed.

A bound evidence receipt cannot be removed.

A claim with existing bindings cannot be removed.

The operator must explicitly:

1. unbind
2. remove

That sequence remains visible in the ledger.

## Relation changes

A claim/evidence pair may have only one active relation.

To change:

`SUPPORTS → CONTRADICTS`

the operator must:

1. UNBIND the existing relation
2. BIND the new relation

This keeps semantic edits replayable.

## Session boundary

Claims and bindings may be changed only while the room is:

- intake
- complete
- aborted

They cannot mutate during active governed execution.

## Reality Gate interaction

PR 10 does **not** change the PR 8 evidence score weights or caps.

Claim graph mutation invalidates a prior Gate authorization because the interpretation of the evidence packet changed.

A new governed run is required afterward.

Future research/gate rungs may use claim coverage and relation structure explicitly.

They must build on this graph rather than creating a parallel research state.

## UI

The Claim Board shows:

- claim text
- derived status
- existing source bindings
- evidence verification class
- relation
- optional binding note
- controls to bind/unbind
- protected claim removal

Evidence cards show `BOUND` and disable removal until bindings are cleared.

## Kernel laws

The kernel rejects:

- non-operator claim creation/removal
- empty claims
- duplicate claim ids
- equivalent duplicate claim text
- bindings to unknown claims
- bindings to unknown evidence
- duplicate binding ids
- a second active relation for the same claim/evidence pair
- unbinding unknown bindings
- deleting bound claims
- deleting bound evidence
- claim graph mutation during active execution

Claims and bindings participate in state fingerprints and exact replay.

## Non-goals

PR 10 does not:

- decide whether a claim is true
- extract claims automatically from model output
- search for evidence
- rank sources
- modify Reality Gate weights
- make contradiction a failure state

Those belong to later, explicit rungs.
