# Mode Scheduler + Governance

PR 4 turns the seven operator modes into executable laws.

## Shared scheduler contract

Every governed run locks a `TurnPlan` with:

- active roles
- ordered speaker queue
- current/max rounds
- timeout
- synthesis trigger
- gate behavior
- output label
- objection requirement

The kernel rejects:
- out-of-order speakers
- a second active speaker
- rounds beyond the mode cap
- advancing rounds before the current queue completes
- Reality Gate scoring before the queue completes
- synthesis results that contradict the mode law

## Mode laws

| Mode | Active roles | Round cap | Gate law | Claim policy | Result law |
| --- | --- | ---: | --- | --- | --- |
| SOLO | Vessie | 1 | informational | informational | synthesis may complete |
| TRIO | Dreamer, Builder, Challenger | 1 | threshold | bound-fresh | below threshold or failed claim policy = withheld |
| COUNCIL | all five roles | 1 | threshold | all-fresh | all registered claims need fresh Challenger review |
| DEBATE | Challenger, Builder, Vessie | 3 | threshold + objection | bound-fresh | objection + threshold + fresh bound claims required |
| DREAM | Dreamer | 1 | informational | informational | always labeled SPECULATIVE, non-actionable |
| BUILD | Builder, Challenger, Archivist | 1 | threshold-or-draft | bound-fresh | failed evidence or claim policy = DRAFT, non-actionable |
| AUDIT | Challenger, Archivist | 1 | threshold | audit-ready | all claims fresh; UNBOUND/THIN claims block action |

The seven operator modes remain orthogonal to any 3-6-9 agent kernel.

## Reality Gate

Default threshold: `0.75`.

The gate score is constrained to `0..1`.

Mode law decides what that score means:
- informational modes expose it without blocking
- threshold modes withhold below threshold
- BUILD may retain low-evidence output only as `DRAFT`
- DEBATE additionally requires at least one logged objection

## Human override

`FORCE SYNTHESIS` is available only when the session is withheld or faulted.

An override is:
- operator-originated
- ledgered
- replayable
- visible in governance reason
- never silently applied

## Simulation drills

The current room exposes deterministic drills:

### SEND / RUN MODE
Executes the currently selected mode using its locked scheduler law and a passing Reality Gate score.

### COUNCIL GATE BLOCK
Runs a canonical Council session at `0.52 / 0.75` and must end in `WITHHELD`.

### TURN TIMEOUT
Starts the selected mode, records a scheduled speaker timeout, emits a governance fault, and withholds synthesis.

These drills exist so failure handling can be reviewed before live providers exist.

## Acceptance tests

CI covers:
- executable definitions for all seven modes
- exact happy-path replay for all modes
- Council gate block
- timeout withholding
- Dream speculative behavior
- Build draft behavior
- Debate objection requirement
- Audit action lock
- turn-order rejection
- premature gate rejection
- round-cap rejection


## Claim policy composition

PR 13 adds a second deterministic governance check beside the numeric Reality Gate.

- SOLO / DREAM: informational only
- TRIO / DEBATE: every bound claim must have a fresh Challenger audit
- BUILD: same requirement, but failure degrades to DRAFT
- COUNCIL: every registered claim must have a fresh Challenger audit
- AUDIT: every registered claim must have a fresh audit and no claim may remain UNBOUND or THIN

CONTESTED claims are allowed. Disagreement is surfaced rather than treated as an automatic failure.

Every normal synthesis event carries a kernel-verified ClaimGovernanceReport.

See [CLAIM_GOVERNANCE.md](CLAIM_GOVERNANCE.md).
