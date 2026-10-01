# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 4 — Modes + Scheduler + Governance**

The mode buttons are now executable laws rather than labels.

PR 4 adds:
- locked scheduler plans for SOLO / TRIO / COUNCIL / DEBATE / DREAM / BUILD / AUDIT
- active-role sets and dimming
- ordered speaker queues
- mode-specific round caps
- turn timeouts
- synthesis triggers
- mode-aware Reality Gate behavior
- Debate objection requirement
- Dream speculative/non-actionable output
- Build low-evidence DRAFT behavior
- Audit action lock below threshold
- kernel rejection of illegal turn order, premature gate scoring, and excess rounds
- visible MODE LAW / SCHEDULER console
- canonical Council gate-block drill
- canonical timeout/fault drill
- force-synthesis arming only for withheld/faulted sessions
- CI coverage across all seven modes

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)

## Run locally

    npm install
    npm run dev

Verification:

    npm test
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

The UI must not care whether an event came from the simulator, OpenAI, Kimi, Ollama, or a future provider. Provider integration replaces the emitter, not the interface contract.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. **Modes + scheduler + governance**
5. Motion layer
6. Crane Fly assignments
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
