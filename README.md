# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 6 — Crane Fly Assignments**

Crane Fly now staffs active cognitive roles with available provider/model seats instead of merely displaying a routing label.

PR 6 adds:
- deterministic role ↔ seat scoring
- normalized capability profiles across all seats
- role-specific routing requirements
- local-first bonuses where appropriate
- availability states: ONLINE / DEGRADED / OFFLINE
- load-balancing penalty
- explicit operator PIN / UNPIN controls
- hard pin supremacy over AUTO routing
- unresolved-role blocking when a pinned seat is offline
- event-sourced seat status, pin, unpin, assignment, and routing receipts
- assignment score, origin, and explanation on every route
- Crane Fly operator switchboard UI
- assignment provenance on role terminals
- assignment motion through Commonline
- automatic routing before governed session execution
- SEND blocked when an active role cannot be staffed
- automated Crane Fly and kernel routing tests

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)
- [Motion Layer](docs/MOTION_LAYER.md)
- [Crane Fly](docs/CRANE_FLY.md)

## Run locally

    npm install
    npm run dev

Verification:

    npm test
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

Crane Fly assignment decisions are canonical events. Automatic routing may choose among available seats, but it does not override an explicit operator pin.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. **Crane Fly assignments**
7. Provider adapters

**Φ THINK TANK is a control room, not eight chat cards.**
