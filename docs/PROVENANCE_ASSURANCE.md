# Provenance Assurance Policy

PR 23 composes the provenance layers from PRs 18 through 22 into deterministic, non-numeric assurance reports.

## Core law

**POLICY SATISFIED ≠ CONTENT TRUE ≠ DECISION CORRECT.**

A satisfied assurance policy means the required provenance artifacts exist in one coherent linked chain and satisfy the structural rules already accepted into canonical state.

It does not mean:
- the underlying claims are factually true
- the synthesis was correct
- a witness is trustworthy in the real world
- a configured TSA is universally trusted
- a publisher is immutable
- a decision should be acted upon

PR 23 deliberately produces no trust score or percentage.

## Why a policy layer

PRs 18 through 22 each answer a different provenance question:

- seal: was this exact dossier signed by this key?
- journal: was this seal inserted into this local hash chain?
- checkpoint: was this journal head frozen into a portable commitment?
- witness: did this external Ed25519 key sign this checkpoint?
- RFC 3161: did this configured timestamp trust chain attest this checkpoint digest?
- publication: was this exact checkpoint read back from this accepted external HTTPS location?

PR 23 does not merge those claims into one scalar.

It evaluates explicit requirement sets.

## Policies

### integrity

Requires:
- verified dossier seal
- transparency journal entry
- portable checkpoint

This is the minimum complete integrity chain evaluated by PR 23.

### witnessed

Requires:
- verified dossier seal
- transparency journal entry
- portable checkpoint
- verified detached witness

### time-attested

Requires:
- verified dossier seal
- transparency journal entry
- portable checkpoint
- RFC 3161 time attestation

### published

Requires:
- verified dossier seal
- transparency journal entry
- portable checkpoint
- verified external publication

### full-provenance

Requires:
- verified dossier seal
- transparency journal entry
- portable checkpoint
- verified detached witness
- RFC 3161 time attestation
- verified external publication

"Full" means full satisfaction of this named provenance policy.

It does not mean complete truth, universal trust, or decision correctness.

## Coherent-chain rule

Requirements must be satisfied by one linked checkpoint chain.

For example:

```
checkpoint A → witness
checkpoint B → RFC 3161 timestamp
checkpoint C → publication
```

does not satisfy `full-provenance`.

A passing full-provenance chain must be:

```
one dossier
  → one linked seal
  → one linked journal entry
  → one linked checkpoint
      → verified witness
      → RFC 3161 receipt
      → verified publication
```

The evaluator searches linked checkpoints from newest to oldest and chooses the newest checkpoint that satisfies the selected policy.

If no checkpoint passes, the newest linked checkpoint becomes the diagnostic basis so missing requirements are actionable.

## Requirement results

Each report contains explicit results:

```
{
  "requirement": "verified-witness",
  "satisfied": true,
  "evidenceIds": ["WIT-...", "WVER-WIT-..."]
}
```

Requirement kinds are:
- `verified-seal`
- `journal-entry`
- `checkpoint`
- `verified-witness`
- `rfc3161-time`
- `verified-publication`

There is no weighted score.

## Basis fingerprint

Every report carries a deterministic `fnv1a32` basis fingerprint over:
- the decision dossier
- all linked seals
- linked seal-verification receipts
- linked transparency entries
- linked checkpoints
- linked witnesses
- linked witness-verification receipts
- linked RFC 3161 timestamp receipts
- linked external publication receipts

The basis fingerprint is a deterministic freshness/replay identifier.

It is not a cryptographic security primitive and does not replace SHA-256 or Ed25519.

## Fresh vs stale report

A report is FRESH when its basis fingerprint matches the currently linked provenance state for that dossier.

If a linked provenance artifact is later added, a previously stored report becomes STALE.

The stale report remains immutable historical state.

The operator may then request a new evaluation, producing a new report id because the basis fingerprint changed.

## Historical journal head is not stale assurance

A checkpoint can refer to a journal head that is no longer the globally newest local journal entry.

That checkpoint is labeled:

```
journalHeadStatus: "historical"
```

This does not automatically fail an assurance policy.

Old dossiers remain valid historical artifacts even after newer dossiers are appended to the journal.

`journalHeadStatus` values:
- `current`
- `historical`
- `unavailable`

Report freshness and journal-head recency are intentionally separate concepts.

## Report shape

A DossierProvenanceAssuranceReport stores:
- deterministic report id
- dossier id
- selected policy
- provenance basis fingerprint
- selected checkpoint id
- journal head status
- explicit requirement results
- missing requirement names
- pass/fail result
- deterministic reason
- `truthAuthority: false`

Report ids have the form:

```
ASSURE-<dossier-id>-<policy>-<basis fingerprint suffix>
```

## Truth authority field

Every report contains:

```json
{
  "truthAuthority": false
}
```

The kernel independently rejects a report that does not exactly match deterministic recomputation.

This field is therefore not a UI disclaimer alone. It is part of the governed receipt contract.

## Event flow

Events:
- `dossier.assurance.requested` — operator
- `dossier.assurance.completed` — system

There is no remote tool call.

The evaluator is a pure deterministic domain function.

The kernel enforces:
- evaluation cannot mutate state during active governed execution
- request must be operator-originated
- dossier must exist
- policy must be supported
- completion must be system-originated
- report must exactly equal deterministic recomputation
- truthAuthority must remain false
- duplicate dossier/policy/basis report ids are rejected
- completion requires a matching operator request
- deterministic replay

## No failure event

PR 23 does not define `dossier.assurance.failed`.

The evaluation has no network/provider/tool dependency.

Invalid requests or invalid reports are integrity errors rejected by the event kernel rather than canonical external failures.

## UI

The Decision Dossier panel adds:
- policy selector
- EVALUATE ASSURANCE
- POLICY SATISFIED / POLICY NOT SATISFIED
- FRESH / STALE state
- selected checkpoint
- current/historical journal-head label
- MET / MISSING requirement rows
- evidence receipt ids for each requirement
- explicit no-truth-authority statement

A fresh report for the currently selected policy cannot be redundantly re-created.

If linked provenance changes, the button becomes available again.

## Export

Decision Dossier JSON exports include:

```
provenanceAssurances
```

Historical stale reports remain included.

## Relationship to synthesis governance

PR 23 is post-decision provenance assurance.

It does not:
- modify Reality Gate
- modify Claim Policy
- modify Argument Policy
- authorize synthesis
- block synthesis
- modify a Decision Dossier
- rewrite an operator override

A future rung may choose to require a provenance policy for a separate release/export/action workflow, but PR 23 does not silently add that authority.

## Non-goals

PR 23 does not:
- create a trust score
- rank witnesses, TSAs, or publishers
- establish identity
- establish reputation
- infer independence from distinct keys
- claim journal immutability
- claim universal trusted time
- claim publication permanence
- make provenance evidence equivalent to factual evidence
- make a decision true
