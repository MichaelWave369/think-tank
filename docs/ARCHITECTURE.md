# Φ THINK TANK Architecture

## Core rule

**If a light changes, a sequenced event explains why.**

The UI is a projection of one event-sourced session state. Simulation and future providers emit the same event shape.

## Human operator authority

The Operator Rail is permanent UI. It owns prompt submission, abort, pin/unpin, and force-synthesis. Reality Gate overrides must be ledgered.

## Roles are not seats

Cognitive roles: Vessie Prime, Dreamer, Builder, Challenger, Archivist.

Provider/model seats: OpenAI seat, Kimi seat, Local Brain.

An Assignment binds a seat to a role for the current session. Crane Fly routes assignments; UI identity does not depend on provider identity.

## Mode semantics

| Mode | Active set | Router policy | Gate behavior |
| --- | --- | --- | --- |
| SOLO | 1 pinned role/seat | manual | informational |
| TRIO | 3 pinned or complementary | auto-trio | synthesis at threshold |
| COUNCIL | all assigned, then Vessie | council-broadcast | withheld below threshold |
| DEBATE | challenger + defenders | debate-round-robin | objection before synthesis |
| DREAM | Dreamer leads | dream-forward | speculative |
| BUILD | Builder + support | build-forward | unsupported plan stays draft |
| AUDIT | Challenger + Archivist | audit-forward | no action before pass |

The seven operator modes are orthogonal to any 3-6-9 agent kernel. They do not replace that triad.

## Reality Gate

Initial evidence threshold: 0.75. Below threshold synthesis may be WITHHELD. The operator can force synthesis; the override is an explicit event.

## Turn model

The scheduler will own phase, speaker queue, round cap, timeout, and synthesis trigger: all-replied, gate-passed, operator-force, or timeout.

## PR ladder

1. Room shell + operator authority
2. Terminal identity + speech viewport
3. Event kernel + deterministic replay
4. Modes + scheduler + governance
5. Motion layer
6. Crane Fly role-seat assignment engine
7. Provider adapters

Provider adapters must not bypass the reducer or directly animate the UI.
