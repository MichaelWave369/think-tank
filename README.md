# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 2 — Terminal Identity + Speech Viewports**

The room now distinguishes cognitive roles from provider/model seats at the monitor level.

PR 2 adds:
- explicit ROLE vs SEAT monitor labels
- non-color terminal state signals for idle, listening, thinking, speaking, warning, dimmed, and offline
- 2–4 line live/last-utterance viewports on Role Terminals
- visible session phase per role
- visible seat staffing per role
- visible role assignments per provider/model seat
- derived seat activity state from the roles it staffs
- capability meter values instead of decorative bars alone
- a fuller Council simulation so every role develops visible history

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)

## Run locally

    npm install
    npm run dev

Production build:

    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

The UI must not care whether an event came from the simulator, OpenAI, Kimi, Ollama, or a future provider. Provider integration replaces the emitter, not the interface contract.

## Build ladder

1. ✅ Room shell + operator authority
2. **Terminal identity + speech viewport**
3. Event kernel + deterministic replay
4. Modes + scheduler + governance
5. Motion layer
6. Crane Fly assignments
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
