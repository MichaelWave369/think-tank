# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 10 — Claim Registry + Claim-to-Source Binding**

Evidence no longer has to float as an undifferentiated packet. The operator can register explicit claims and bind individual evidence receipts as supporting, contradicting, or contextual.

PR 10 adds:
- canonical claim registry
- canonical claim/evidence bindings
- SUPPORTS / CONTRADICTS / CONTEXT relations
- derived claim status
- UNBOUND / SUPPORTED / CHALLENGED / CONTESTED / CONTEXT-ONLY states
- duplicate-claim rejection
- unknown-reference rejection
- one active relation per claim/source pair
- explicit unbind-before-relation-change law
- bound evidence deletion protection
- bound claim deletion protection
- claim graph mutation lock during active execution
- prior Gate authorization invalidation after semantic graph edits
- exact claim graph replay
- Claim Board / Source Map UI
- bound markers in Evidence Packet
- claim graph telemetry in System Status

### Important semantic rule

**Bindings describe how evidence bears on a claim. They do not declare the claim true or false.**

PR 10 deliberately leaves the Reality Gate scoring weights unchanged.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)
- [Motion Layer](docs/MOTION_LAYER.md)
- [Crane Fly](docs/CRANE_FLY.md)
- [Providers](docs/PROVIDERS.md)
- [Reality Gate Evidence Engine](docs/EVIDENCE_GATE.md)
- [Machine-Verified Evidence Retrieval](docs/MACHINE_EVIDENCE.md)
- [Claim Registry + Bindings](docs/CLAIM_BINDINGS.md)

## Local-first setup

    cp .env.example .env
    npm install
    npm run bridge

In another terminal:

    npm run dev

Verification:

    npm test
    npm run bridge:check
    npm run bridge:test
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

If a source changes what it is claimed to support or contradict, an explicit binding event explains that too.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly assignments
7. ✅ Provider adapters + LIVE execution
8. ✅ Reality Gate evidence engine
9. ✅ Machine-verified evidence retrieval
10. **Claim registry + claim-to-source binding**

**Φ THINK TANK is a control room, not eight chat cards.**
