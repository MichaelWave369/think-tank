# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 5 — Semantic Motion Layer**

The room now moves from events instead of decorative timers.

PR 5 adds:
- semantic motion cues derived from canonical ledger events
- deterministic one-event-at-a-time simulation playback
- seat → Φ Commonline → role route visualization
- role and provider-seat event hits
- room wake, gate pass/block, fault, completion, override, and abort cues
- one global motion policy owner
- reduced-motion semantic fallback
- hidden-tab FX pause
- transform/opacity-only animation policy
- operator lockout during playback while ABORT remains live
- System Status playback + Motion FX state
- ledger print animation
- ledger auto-scroll pause/resume
- tear/export receipt text
- automated motion-cue tests

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)
- [Motion Layer](docs/MOTION_LAYER.md)

## Run locally

    npm install
    npm run dev

Verification:

    npm test
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

Motion is a projection of accepted events. Provider integration replaces event emitters, not the interface or motion contract.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. **Semantic motion layer**
6. Crane Fly assignments
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
