# Φ THINK TANK Architecture

## Core rule

**If a light changes, a sequenced event explains why.**

The UI is a projection of one event-sourced session state. Simulation and real providers emit the same canonical event shape.

## Event kernel

Every event carries session, sequence, seed, source, mode, phase, and deterministic pre/post projection fingerprints.

Replay validates each transition before applying it. The same ledger from the same initial state must reconstruct the same visible room.

See [EVENT_KERNEL.md](EVENT_KERNEL.md).

## Human operator authority

The Operator Rail is permanent UI. Prompt submission, mode selection, abort, pin/unpin, seat availability, provider-health sync, and force-synthesis belong to the operator surface.

Operational controls do not bypass the ledger.

During SIM or LIVE execution, mutating controls lock while ABORT remains available.

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

Provider adapters staff seats. They do not redefine cognitive roles.

## Crane Fly assignment engine

Crane Fly owns deterministic role ↔ seat staffing for the active collaboration mode.

Operator pins are hard constraints. AUTO routing does not override them.

Routing occurs after the operator prompt and before governed session start.

See [CRANE_FLY.md](CRANE_FLY.md).

## Provider adapters

PR 7 adds a local-only provider bridge.

The browser never receives OpenAI or Kimi API keys.

Current transports:
- Ollama `/api/tags` + `/api/chat`
- OpenAI Responses API
- Kimi OpenAI-compatible chat completions

Provider health is observational until the operator explicitly syncs it into Crane Fly.

LIVE provider responses emit canonical `source: provider` events.

Provider failure emits a canonical fault path rather than bypassing the scheduler.

No public unauthenticated key-holding proxy is shipped.

See [PROVIDERS.md](PROVIDERS.md).

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

The kernel rejects histories that violate that schedule.

See [MODE_GOVERNANCE.md](MODE_GOVERNANCE.md).

## Semantic motion

Motion is a projection of accepted events, not a second state machine.

Assignment, SIM, and LIVE provider events use the same route visualization:

`SEAT → Φ COMMONLINE → ROLE`

Hidden tabs pause FX. Reduced motion preserves semantic state.

See [MOTION_LAYER.md](MOTION_LAYER.md).

## Reality Gate evidence engine

Initial evidence threshold: 0.75.

LIVE sessions now compute a deterministic evidence packet across provider provenance, role coverage, seat diversity, challenge coverage, and explicit external support.

Model output alone is capped at 0.65.

A single operator-attested external reference is capped at 0.74.

Operator-created evidence cannot self-declare machine verification.

The event kernel recomputes scored LIVE gate receipts and rejects mismatched scores or breakdowns.

Reality Gate is a provenance/support governance mechanism, not a factual truth oracle.

See [EVIDENCE_GATE.md](EVIDENCE_GATE.md).

## PR ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly role-seat assignment engine
7. ✅ Provider adapters + LIVE execution
8. Reality Gate evidence engine

Future work can add machine-verified retrieval/tool evidence, authenticated remote deployment, richer provider discovery, streaming, tool execution, and voice without changing the core event contract.
