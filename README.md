# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 8 — Reality Gate Evidence Engine**

LIVE sessions now receive a deterministic, inspectable evidence score instead of a placeholder gate value.

PR 8 adds:
- canonical evidence receipts
- operator-attested reference entry/removal
- explicit evidence verification classes
- deterministic Reality Gate score breakdown
- provider provenance scoring
- required-role coverage scoring
- low-weight seat-diversity scoring
- challenge coverage scoring
- external-support scoring
- hard evidence-class confidence caps
- model-consensus ceiling of 0.65 without external evidence
- single-attestation ceiling of 0.74
- machine-verified evidence reserved for system/tool integrations
- gate score + cap visible in the control room
- kernel recomputation of scored LIVE gate receipts
- forged score/breakdown rejection
- exact evidence replay
- automated evidence and LIVE gate tests

### Important semantic rule

**Reality Gate is evidence/provenance governance, not a truth oracle.**

Multiple models agreeing with one another do not become external evidence merely by agreeing.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)
- [Motion Layer](docs/MOTION_LAYER.md)
- [Crane Fly](docs/CRANE_FLY.md)
- [Providers](docs/PROVIDERS.md)
- [Reality Gate Evidence Engine](docs/EVIDENCE_GATE.md)

## Local-first setup

    cp .env.example .env
    npm install
    npm run bridge

In another terminal:

    npm run dev

Verification:

    npm test
    npm run bridge:check
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

If the Reality Gate changes, a replayable evidence packet explains why.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly assignments
7. ✅ Provider adapters + LIVE execution
8. **Reality Gate evidence engine**

**Φ THINK TANK is a control room, not eight chat cards.**
