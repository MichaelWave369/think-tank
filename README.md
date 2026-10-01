# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 12 — Challenger Claim Coverage Audits**

The Think Tank can now deterministically audit the structural coverage around every registered claim without pretending that evidence structure is the same thing as factual truth.

PR 12 adds:
- deterministic Challenger structural audits
- canonical claim review request/completion events
- immutable claim review receipts
- per-claim basis fingerprints
- FRESH / STALE / UNREVIEWED review state
- UNBOUND / THIN / DIRECTIONAL / CONTESTED / CONTEXT-ONLY coverage states
- support / contradiction / context counts
- machine-verified / attested / unverified counts
- research-lineage counts
- explicit structural flags
- kernel recomputation of every review receipt
- forged review rejection
- graph-change-during-review rejection
- exact review replay
- Claim Coverage Matrix UI
- System Status audit freshness telemetry

### Important semantic rule

**COVERAGE ≠ TRUTH.**

PR 12 deliberately leaves Reality Gate weights and authorization behavior unchanged.

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
- [Governed Research / Search](docs/GOVERNED_RESEARCH.md)
- [Challenger Claim Coverage](docs/CHALLENGER_COVERAGE.md)

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

If Challenger says a claim was reviewed, an immutable deterministic receipt explains exactly what graph it reviewed.

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
10. ✅ Claim registry + claim-to-source binding
11. ✅ Governed research / search
12. **Challenger claim coverage audits**

**Φ THINK TANK is a control room, not eight chat cards.**
