# Reality Gate Evidence Engine

PR 8 replaces the LIVE placeholder score with a deterministic evidence packet.

## What the gate is

Reality Gate is a governance score for:

- provider provenance
- completion of required cognitive roles
- diversity of provider seats
- required challenge coverage
- explicit external support

It is **not** a factual truth oracle.

A high gate score means the session satisfied the declared evidence/provenance law. It does not prove that every underlying claim is true.

## Scoring law

The raw score is:

- 20% provider provenance
- 20% required-role coverage
- 10% provider-seat diversity
- 15% challenge coverage
- 35% external support

All components are constrained to 0..1.

### Provider provenance

Provider output receives full provenance credit when it carries:

- role
- seat
- provider model
- latency receipt

Missing provider metadata reduces provenance credit.

### Role coverage

Required roles come from the locked mode scheduler.

A role counts as complete only when an accepted provider utterance/challenge event exists for it.

### Seat diversity

Distinct provider seats provide routing diversity.

This is deliberately low-weight.

Multiple models agreeing with one another are not treated as independent external evidence.

### Challenge coverage

If Challenger is part of the mode, at least one accepted objection is required for full challenge coverage.

Modes without Challenger receive the full neutral challenge component.

### External support

Evidence references have explicit verification classes:

- `unverified` = 0.10 quality
- `operator-attested` = 0.65 quality
- `machine-verified` = 1.00 quality

External support also uses breadth. Two references are required for full breadth.

## Confidence caps

The gate uses caps so model consensus cannot bootstrap itself into evidence.

### No attested or verified external evidence

Maximum score:

`0.65`

A healthy multi-model session can therefore be well-formed and still remain below the normal `0.75` gate.

### Exactly one operator-attested reference and no machine-verified evidence

Maximum score:

`0.74`

One operator attestation cannot cross the default gate by itself.

### Two or more operator-attested references

The special cap is removed. The normal weighted score applies.

### Machine-verified evidence

The special cap is removed.

PR 9 implements the first machine-verification path.

A machine-verified reference must originate from the governed URL retrieval tool and include a complete retrieval receipt with SHA-256 provenance.

Machine verification proves retrieval provenance. It does not certify factual correctness.

## Operator evidence

The Evidence Packet console can add:

- label
- URI/reference
- note

Operator-added evidence is always recorded as:

`operator-attested`

The evidence receipt is a canonical event and participates in replay fingerprints.

Removal is also a canonical operator event.

## Kernel laws

The kernel rejects:

- missing evidence ids or labels
- duplicate evidence ids
- removal of nonexistent evidence
- operator evidence claiming machine verification
- mismatched `addedBy` provenance
- gate breakdowns that differ from deterministic recomputation
- gate scores that differ from the recomputed final score

SIM fixtures may continue to emit explicit gate scores without an evidence breakdown.

LIVE evidence scoring must carry the deterministic breakdown.

## LIVE sequence

After all required provider turns complete:

1. collect accepted provider receipts
2. evaluate the current evidence packet
3. compute raw score
4. apply evidence-class cap
5. emit `gate.scored` with full breakdown
6. apply the selected mode governance law
7. complete, draft, speculate, or withhold

## Example

Healthy Council, no external evidence:

- provenance = 1.00
- role coverage = 1.00
- seat diversity = 1.00
- challenge = 1.00
- external support = 0.00
- raw = 0.65
- cap = 0.65
- final = 0.65
- result = WITHHELD

Healthy Council, two operator-attested references:

- external support = 0.65
- raw = 0.8775
- cap = 1.00
- final = 0.8775
- result = governed by the normal mode threshold

## Machine retrieval integration

PR 9 adds governed URL retrieval described in [MACHINE_EVIDENCE.md](MACHINE_EVIDENCE.md).

The scoring law in this document is unchanged.

A healthy Council with one machine-verified external source receives external-support breadth 0.50 and quality 1.00, producing a final score of 0.825 under the current weights.

Future claim-level verification or search tools should add evidence receipts. They should not bypass this scorer.
