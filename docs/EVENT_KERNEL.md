# Event Kernel + Deterministic Replay

The Think Tank UI is a projection of one ordered event ledger.

## Canonical event envelope

Every accepted event carries:

- schema version
- session id
- sequence number
- seed
- source
- collaboration mode
- event kind
- phase
- optional role and seat
- optional message / gate score / override
- pre-state fingerprint
- post-state fingerprint

## Replay law

Starting from the same initial state, the same ordered ledger must reconstruct the same render-affecting projection.

The kernel validates every step:

1. schema version
2. session id
3. seed
4. exact next sequence number
5. pre-state fingerprint
6. projected post-state fingerprint

A dropped event, re-ordered event, changed payload, wrong session, or wrong seed invalidates replay.

## Projection fingerprint

The fingerprint covers render-affecting session state:

- session and seed
- mode and Crane Fly router policy
- phase and sequence
- operator prompt
- Reality Gate state
- role-seat assignments
- terminal states
- latest role utterances

The ledger array itself is excluded to avoid self-referential hashing.

The current implementation uses deterministic FNV-1a 32-bit as a replay checksum. It is **not** a cryptographic security hash and must not be treated as one.

## Event sources

- `operator`
- `system`
- `simulator`
- `provider`

Future provider adapters must emit this same event envelope.

## UI contract

The room exposes kernel status as:

- `REPLAY EXACT`
- `REPLAY FAULT`

The paper ledger displays the before → after projection fingerprint for every event.

`REPLAY LEDGER` discards the current projection and reconstructs it from the canonical event history.

## Test gates

CI must reject changes if any of these fail:

- exact deterministic replay
- sequence-gap detection
- session mismatch detection
- seed mismatch detection
- payload-tamper detection
- ledgered mode selection replay

## Architectural rule

**No operational UI state gets a private shortcut around the event path.**

Mode changes, operator prompts, aborts, gate decisions, overrides, role turns, utterances, and future provider output all enter through the same kernel contract.


## Synthesis governance receipts

PR 16 requires every normal synthesis resolution to carry both:

- ClaimGovernanceReport
- ArgumentGovernanceReport

The kernel recomputes both receipts from canonical state before accepting synthesis.completed or synthesis.withheld.

A mismatch is an integrity failure.

This keeps numeric evidence scoring, deterministic structural claim review, and human-accepted provider argument maps as separate replayable authorities.


## Decision dossiers

PR 17 requires every normal synthesis resolution to carry a deterministic SynthesisDecisionDossier.

The kernel recomputes the dossier from pre-decision canonical state and rejects any mismatch.

The dossier is historical and immutable.

FORCE SYNTHESIS creates a separate DecisionOverrideReceipt linked to the latest withheld dossier; it does not mutate the normal decision receipt.

See [DECISION_DOSSIER.md](DECISION_DOSSIER.md).
