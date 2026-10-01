# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 3 — Event Kernel + Deterministic Replay**

The ledger is now becoming the source of truth instead of a decorative transcript.

PR 3 adds:
- canonical event envelope with schema version, source, session, seed, sequence, mode, and phase
- deterministic pre-state and post-state projection fingerprints
- strict replay validation
- exact ledger reconstruction from the initial room state
- event-sourced operator mode selection
- event-sourced operator prompts, aborts, and overrides
- visible `REPLAY EXACT` / `REPLAY FAULT` status
- paper-ledger before → after fingerprints
- `REPLAY LEDGER` operator control
- automated tests for sequence gaps, session mismatch, seed mismatch, payload tampering, exact replay, and mode replay

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)

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
3. **Event kernel + deterministic replay**
4. Modes + scheduler + governance
5. Motion layer
6. Crane Fly assignments
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
