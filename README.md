# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 17 — Synthesis Decision Dossier**

The Think Tank now freezes every normal synthesis decision into one deterministic dossier that captures the exact governance/provenance basis without inventing new authority.

PR 17 adds:
- canonical SynthesisDecisionDossier receipts
- deterministic decision-basis fingerprints
- normal outcome / label / action authority
- Reality Gate snapshot
- Claim Policy receipt
- Argument Policy receipt
- claim / binding / evidence / excerpt basis
- structural-review basis fingerprints
- provider argument-map basis fingerprints
- current-run provider turn provenance
- immutable dossier history
- automatic dossier minting for LIVE and SIM synthesis
- governance-reason integrity checks
- separate linked DecisionOverrideReceipt for FORCE SYNTHESIS
- one-override-per-withheld-dossier law
- completed-dossier override rejection
- Decision Dossier UI
- JSON dossier export
- ledger DOS / OVR linkage

### Important semantic rule

**DOSSIER ≠ NEW AUTHORITY.**

The dossier records why a decision existed. It does not make that decision more true, more evidenced, or more authorized.

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
- [Claim-Aware Governance](docs/CLAIM_GOVERNANCE.md)
- [Hash-Locked Source Excerpts](docs/SOURCE_EXCERPTS.md)
- [Excerpt-Aware Argument Review](docs/ARGUMENT_REVIEW.md)
- [Argument-Map Governance](docs/ARGUMENT_GOVERNANCE.md)
- [Synthesis Decision Dossier](docs/DECISION_DOSSIER.md)

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

Every normal synthesis now carries a deterministic decision dossier; any FORCE SYNTHESIS action is a separate linked operator override receipt.

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
12. ✅ Challenger claim coverage audits
13. ✅ Claim-aware governance policy
14. ✅ Hash-locked source excerpts
15. ✅ Excerpt-aware Challenger argument review
16. ✅ Argument-map governance
17. **Synthesis decision dossier**

**Φ THINK TANK is a control room, not eight chat cards.**
