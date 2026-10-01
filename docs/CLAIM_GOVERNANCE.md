# Claim-Aware Governance Policy

PR 13 turns PR 12 Challenger coverage audits into explicit mode-level authorization policy.

## Core law

**Reality Gate and Claim Policy are separate requirements.**

Reality Gate answers:

> Did the evidence/provenance packet satisfy the numeric mode threshold?

Claim Policy answers:

> Did the relevant claims satisfy the review requirements for this mode?

A session may therefore have:

- Reality Gate PASS
- Claim Policy BLOCK

and synthesis/action may still be withheld.

Neither mechanism is a truth oracle.

## Mode policy

| Mode | Claim policy | Effect |
| --- | --- | --- |
| SOLO | informational | never blocks |
| DREAM | informational | never blocks |
| TRIO | bound-fresh | every claim with at least one evidence binding needs a fresh Challenger audit |
| DEBATE | bound-fresh | every claim with at least one evidence binding needs a fresh Challenger audit |
| BUILD | bound-fresh | failed claim policy downgrades output to DRAFT |
| COUNCIL | all-fresh | every registered claim needs a fresh Challenger audit |
| AUDIT | audit-ready | every registered claim needs a fresh audit and no applicable claim may be UNBOUND or THIN |

No registered/applicable claims means there is nothing for claim policy to block.

## Contested claims

CONTESTED is allowed.

The system does not punish a claim merely because evidence exists in both directions.

Contradiction is surfaced, not suppressed.

## Claim governance receipt

Every normal synthesis resolution carries a deterministic `ClaimGovernanceReport` containing:

- mode
- policy
- applicable claim ids
- fresh claim ids
- missing-review claim ids
- stale-review claim ids
- coverage-blocked claim ids
- pass/block result
- human-readable reason

The report is part of canonical state and replay fingerprints.

## Kernel law

For every `synthesis.completed` or `synthesis.withheld` event:

1. kernel recomputes current claim policy from canonical claim/binding/review state
2. synthesis event must include a claim governance receipt
3. supplied receipt must exactly match recomputation
4. scheduler evaluates numeric Gate + objection law + claim policy
5. event kind, label, and action authorization must match that combined decision

A forged `passed: true` report is rejected.

## BUILD behavior

BUILD keeps its existing graceful degradation behavior.

If:
- numeric evidence is below threshold, or
- claim policy is not satisfied

then BUILD may retain output only as:

`DRAFT`

Action remains locked.

## Strict modes

TRIO, COUNCIL, DEBATE, and AUDIT fail closed when their claim policy fails after numeric Gate requirements are otherwise satisfied.

## Human override

PR 13 does not remove human authority.

`FORCE SYNTHESIS` remains the explicit, ledgered override for a withheld or faulted session.

The override does not rewrite the failed policy receipt.

## Audit policy

AUDIT is intentionally stricter.

Every registered claim must:
- have a latest Challenger review
- have that review remain fresh
- have coverage beyond UNBOUND / THIN

Allowed structural states include:
- DIRECTIONAL
- CONTESTED
- CONTEXT-ONLY

This rule is structural, not a statement that those states are equally persuasive or factually correct.

## Observation vs authorization

PR 12 reviews remain observational when created.

Running a new Challenger audit does not retroactively revoke or rewrite a prior completed session.

A future session evaluates the then-current review state.

Actual claim/evidence graph mutation already invalidates prior current-session authorization under the existing PR 10/11 laws.

## Non-goals

PR 13 does not:

- change Reality Gate numeric weights
- score website credibility
- rank claims by truth
- make disagreement a failure
- automatically create reviews
- automatically search for missing evidence
- remove operator override
