# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 13 — Claim-Aware Governance Policy**

The Think Tank now composes numeric Reality Gate results with deterministic claim-review requirements at synthesis time.

PR 13 adds:
- explicit claim policy per collaboration mode
- informational / bound-fresh / all-fresh / audit-ready policies
- canonical ClaimGovernanceReport receipts
- kernel recomputation of every synthesis claim-policy receipt
- forged policy receipt rejection
- claim-policy-aware LIVE and SIM execution
- COUNCIL all-claims freshness requirement
- TRIO / DEBATE fresh review requirement for bound claims
- BUILD downgrade to DRAFT when claim policy fails
- AUDIT fresh-review + non-THIN/non-UNBOUND requirement
- Governance panel claim-policy telemetry
- preserved human FORCE SYNTHESIS override

### Important semantic rule

**REALITY GATE PASS ≠ CLAIM POLICY PASS.**

Both are governance checks. Neither is a truth oracle.

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

If synthesis is authorized or withheld, deterministic receipts explain both the numeric Reality Gate result and the claim-review policy result.

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
13. **Claim-aware governance policy**

**Φ THINK TANK is a control room, not eight chat cards.**
