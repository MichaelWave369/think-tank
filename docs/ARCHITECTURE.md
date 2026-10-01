# Φ THINK TANK Architecture

## Core rule

**If a light changes, a sequenced event explains why.**

The UI is a projection of one event-sourced session state. Simulation and future providers emit the same canonical event shape.

## Event kernel

Every event carries session, sequence, seed, source, mode, phase, and deterministic pre/post projection fingerprints.

Replay validates each transition before applying it. The same ledger from the same initial state must reconstruct the same visible room.

See [EVENT_KERNEL.md](EVENT_KERNEL.md).

## Human operator authority

The Operator Rail is permanent UI. Prompt submission, mode selection, abort, pin/unpin, and force-synthesis belong to the operator surface.

Operational controls do not bypass the ledger. Operator actions are canonical events.

`FORCE SYNTHESIS` only arms when the session is withheld or faulted, and the override is itself ledgered.

During simulated event playback, mutating controls lock while ABORT remains available.

## Roles are not seats

Cognitive roles:
- Vessie Prime
- Dreamer
- Builder
- Challenger
- Archivist

Provider/model seats:
- OpenAI seat
- Kimi seat
- Local Brain

An Assignment binds a seat to a role for the current session. Crane Fly routes assignments; UI identity does not depend on provider identity.

## Modes + scheduler

Each mode locks:
- active role set
- speaker queue
- round cap
- timeout
- synthesis trigger
- gate behavior
- output label
- objection requirement

The kernel rejects histories that violate that schedule even if someone recomputes replay fingerprints.

See [MODE_GOVERNANCE.md](MODE_GOVERNANCE.md).

## Semantic motion

Motion is a projection of accepted events, not a second state machine.

The global motion policy is:
- full
- reduced
- paused

Hidden tabs pause FX. Reduced motion preserves semantic state without traveling effects.

Animated properties are restricted to transform and opacity.

Simulation batches are pre-sealed by the event kernel and then visually projected one event at a time so routing can actually be observed without changing ledger semantics.

See [MOTION_LAYER.md](MOTION_LAYER.md).

## Mode semantics

| Mode | Active set | Router policy | Gate behavior |
| --- | --- | --- | --- |
| SOLO | Vessie | manual | informational |
| TRIO | Dreamer + Builder + Challenger | auto-trio | synthesis at threshold |
| COUNCIL | all five roles | council-broadcast | withheld below threshold |
| DEBATE | Challenger + Builder + Vessie | debate-round-robin | objection + threshold |
| DREAM | Dreamer | dream-forward | speculative, non-actionable |
| BUILD | Builder + Challenger + Archivist | build-forward | low evidence remains draft |
| AUDIT | Challenger + Archivist | audit-forward | no action below threshold |

The seven operator modes are orthogonal to any 3-6-9 agent kernel. They do not replace that triad.

## Reality Gate

Initial evidence threshold: 0.75.

The gate is interpreted by the selected mode law. A low score may withhold synthesis, preserve only a draft, or remain informational depending on mode.

## PR ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. Semantic motion layer
6. Crane Fly role-seat assignment engine
7. Provider adapters

Provider adapters must emit kernel events. They must not bypass the scheduler, reducer, or directly animate the UI.
