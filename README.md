# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 1 — Room Shell + Operator Authority**

The first skeleton includes:

- Vessie Prime, Dreamer, Builder, Challenger, and Archivist as cognitive role terminals
- OpenAI, Kimi, and Local Brain as provider/model seats
- explicit role ↔ seat assignments
- Commonline shared event bus
- Operator Rail with SEND, ABORT, PIN/UNPIN, and FORCE SYNTHESIS
- SOLO, TRIO, COUNCIL, DEBATE, DREAM, BUILD, and AUDIT modes
- Crane Fly router policy labels
- Reality Gate threshold with visible WITHHELD state
- paper-roll Receipt / Ledger
- reducer-driven event state with deterministic sequence numbers
- simulated Council path
- responsive room-map/sticky operator foundations
- reduced-motion support

## Run locally

    npm install
    npm run dev

Production build:

    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

The UI must not care whether an event came from the simulator, OpenAI, Kimi, Ollama, or a future provider. Provider integration replaces the emitter, not the interface contract.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Build ladder

1. Room shell + operator authority
2. Terminal identity + speech viewport
3. Event kernel + deterministic replay
4. Modes + scheduler + governance
5. Motion layer
6. Crane Fly assignments
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
