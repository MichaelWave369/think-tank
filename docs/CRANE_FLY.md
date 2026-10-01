# Crane Fly Assignment Engine

PR 6 turns Crane Fly from a status label into the role ↔ seat staffing engine.

## Core distinction

Roles are cognitive jobs.

Seats are provider/model substrates.

Crane Fly binds seats to active roles for the selected mode. It does not redefine the role identity.

## Inputs

Crane Fly considers:

- selected collaboration mode
- active roles required by that mode
- normalized seat capability scores
- seat locality
- seat availability: ONLINE / DEGRADED / OFFLINE
- current routing load
- explicit operator pins

## Role needs

Current weighted role requirements:

- Vessie Prime: synthesis, reasoning, context, memory
- Dreamer: imagination, context, reasoning, memory
- Builder: build capability, tools, reasoning, speed, privacy
- Challenger: critique, reasoning, web, context
- Archivist: archive, memory, context, privacy

These weights are routing heuristics, not claims about provider quality in the abstract.

## Seat capability scale

Each seat publishes a normalized 0–5 capability profile across:

REASON, CONTEXT, TOOLS, WEB, MEMORY, PRIVATE, OFFLINE, SPEED, BUILD, CRITIQUE, ARCHIVE, IMAGINE, SYNTHESIS.

The current profiles are explicit scaffold data and may later be populated from real provider/model capability discovery.

## Scoring

For each active role:

1. compute weighted capability fit
2. apply availability multiplier
3. add role-specific local-first bonus when the seat is local
4. apply a small load-balancing penalty
5. apply a tiny deterministic tie-break

The result is a deterministic score and explanation.

## Operator pins

A pin is a hard constraint.

AUTO routing:

- honors the pin if the seat is available
- never silently routes the role elsewhere
- marks the role unresolved if the pinned seat is offline

The operator must unpin or restore the seat.

## Availability

ONLINE:
- full routing score

DEGRADED:
- score is reduced

OFFLINE:
- seat is excluded from automatic assignment
- new assignments to it are rejected by the event kernel

Existing historical assignment receipts remain in the ledger.

## Event contract

Routing controls emit canonical events:

- `seat.status`
- `role.pinned`
- `role.unpinned`
- `role.assigned`
- `routing.completed`

Each `role.assigned` event carries:

- role
- seat
- assignment score
- origin: AUTO or OPERATOR-PIN
- human-readable reason

Assignments participate in replay fingerprints exactly like scheduler and governance state.

## Session order

A normal run now follows:

1. operator prompt
2. Crane Fly assignment receipts
3. routing completed
4. session start
5. schedule planned
6. governed turns
7. Reality Gate
8. synthesis

## Visual contract

Assignment events use the same semantic motion path as runtime routing:

SEAT → Φ COMMONLINE → ROLE

The monitor shows the recorded assignment origin and score.

## Kernel laws

The event kernel rejects:

- assignment to an offline seat
- assignment that contradicts an operator pin
- assignment without a finite score
- assignment without an explanation
- assignment without a valid origin
- malformed pin/status events

## Acceptance criteria

- same state produces same assignment plan
- Council has deterministic staffing
- pins override AUTO
- offline pinned roles become unresolved
- offline seats are never auto-assigned
- degraded seats receive a score penalty
- routing receipts replay exactly
- SEND is blocked when an active role is unresolved
