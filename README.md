# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 16 — Argument-Map Governance**

The Think Tank now composes fresh human-accepted Challenger argument maps into synthesis authorization for rigorous modes without turning provider reasoning into a truth score.

PR 16 adds:
- per-mode argument policy
- informational vs fresh-accepted-on-excerpts laws
- deterministic ArgumentGovernanceReport receipts
- applicability only for claims with pinned excerpts on bound evidence
- fresh accepted / missing / stale / draft-only classification
- kernel recomputation of argument policy at synthesis
- forged argument-policy PASS rejection
- COUNCIL argument-map requirement
- DEBATE argument-map requirement
- AUDIT argument-map requirement
- LIVE + SIM policy composition
- current vs last argument-policy telemetry
- preserved FORCE SYNTHESIS override
- isolated LIVE regression where evidence + structural audit pass but argument policy blocks

### Important semantic rule

**FRESH + ACCEPTED ≠ TRUE.**

Acceptance records human approval of a current reasoning artifact. Reality Gate, deterministic structural audit, and argument-map governance remain separate checks.

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

If rigorous synthesis depends on an argument map, the ledger preserves both the current deterministic policy and the exact argument-policy receipt used by that run.

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
16. **Argument-map governance**

**Φ THINK TANK is a control room, not eight chat cards.**
