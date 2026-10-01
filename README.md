# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 11 — Governed Research / Search**

The Think Tank can now discover candidate sources for registered claims without treating search results as evidence.

PR 11 adds:
- optional local-first SearXNG search adapter
- operator-authorized claim-scoped searches
- canonical search request / completion / failure events
- replayable research search receipts
- SHA-256 result-set digest
- quarantined research candidates
- candidate URL normalization and deduplication
- candidate count caps
- candidate-to-machine-evidence lineage
- explicit VERIFY → EVIDENCE promotion
- existing evidence reuse
- duplicate evidence URI rejection
- duplicate machine-content digest rejection
- Research Console UI
- search/candidate System Status telemetry
- bridge runtime helper repair
- expanded bridge and kernel tests

### Important semantic rule

**SEARCH RESULT ≠ EVIDENCE.**

Discovery contributes zero to Reality Gate until a candidate passes governed machine retrieval.

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

Search discovery, source promotion, retrieval verification, and claim interpretation are separate ledger-visible transitions.

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
11. **Governed research / search**

**Φ THINK TANK is a control room, not eight chat cards.**
