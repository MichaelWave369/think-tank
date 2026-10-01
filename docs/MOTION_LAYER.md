# Semantic Motion Layer

PR 5 makes the Think Tank move without creating a second source of truth.

## Core law

**Motion is a projection of ledger events. Motion never creates operational state.**

The event kernel remains authoritative. The motion layer consumes the latest accepted event and current room projection, then derives a temporary semantic cue.

## Motion cues

Current cue classes:

- `wake` — governed session opens
- `route` — seat → Commonline → role handoff begins
- `speak` — role utterance completes
- `challenge` — Challenger objection lands
- `gate-pass` — Reality Gate passes
- `gate-block` — gate or synthesis is withheld
- `fault` — scheduler/governance fault
- `complete` — governed synthesis completes
- `override` — human force-synthesis override
- `abort` — operator abort
- `ledger` — low-intensity receipt/state event
- `idle` — no ledger event yet

A cue carries the originating sequence number, role, assigned seat, label, and intensity.

## One motion-policy owner

`useMotionPolicy()` owns the global FX policy:

- `full`
- `reduced`
- `paused`

The room publishes this policy through `data-motion`. Components may render semantic motion affordances, but they do not choose their own motion policy.

## Reduced motion

Reduced motion keeps state changes and semantic marks but removes traveling/flickering effects.

Examples:
- active route remains visibly marked
- active terminal keeps a static event outline
- Commonline still names the active handoff
- no traveling pulses are required to understand state

## Hidden tabs

When `document.visibilityState === "hidden"`, motion policy becomes `paused`.

FX animations are paused/hidden. The event ledger remains authoritative.

## Animation restrictions

Animated properties are limited to:

- `transform`
- `opacity`

Do not animate:
- layout dimensions
- box-shadow
- expensive filters
- positional layout properties

Static shadows/borders remain allowed.

## Deterministic playback clock

Simulation events are pre-built and sealed by the event kernel, then projected one at a time by the UI playback clock.

This solves a real problem: dispatching a full simulated Council batch synchronously can collapse visually into the final state.

During playback:
- SEND is locked
- mode switching is locked
- simulation drills are locked
- replay is locked
- **ABORT remains available**

Abort cancels future playback events and appends a new canonical abort event from the state already reached.

## Commonline routing

For role events, the motion projector derives the staffing seat from current assignments when the event itself does not contain a seat.

The visual handoff is therefore:

`SEAT → Φ COMMONLINE → ROLE`

This is a visual projection of routing already represented by state. It does not create assignments.

## Ledger printing

The paper ledger now supports:

- auto-scroll as receipts arrive
- pause/resume print following
- per-receipt print motion
- tear/export to text
- replay exact

Pausing the print view does not pause the ledger itself.

## Acceptance criteria

- every visible semantic pulse maps to a ledger sequence
- role/seat highlights match the active cue
- Commonline route labels match role staffing
- playback preserves exact replay
- abort can stop a simulated run without sequence gaps
- reduced motion preserves meaning
- hidden-tab policy pauses FX
- motion uses transform/opacity only
