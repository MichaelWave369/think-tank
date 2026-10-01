# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 15 — Excerpt-Aware Challenger Argument Review**

The Think Tank can now ask the assigned Challenger provider to build a structured argument map over exact, hash-locked excerpts while keeping provider reasoning separate from evidence and operator authority.

PR 15 adds:
- deterministic argument-review basis fingerprints
- max 12 excerpts / 12,000 characters per review
- prompt-injection boundary for untrusted source excerpts
- raw-JSON Challenger review contract
- one analysis point per eligible excerpt
- anti-cherry-picking exact excerpt coverage
- provider provenance on every review
- DRAFT → ACCEPTED / DISMISSED human lifecycle
- stale-review detection
- stale DRAFT acceptance rejection
- offline Challenger seat rejection
- claim/excerpt dependency protection
- Argument Review Console
- exact canonical quote display beside provider reasoning
- argument-review telemetry
- parser + kernel integrity tests

### Important semantic rule

**PROVIDER ARGUMENT MAP ≠ EVIDENCE ≠ TRUTH.**

The provider analyzes the argument. Exact quotations, claim relations, evidence provenance, and operator acceptance remain separate authorities.

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

If Challenger analyzes an excerpt, the ledger preserves the exact excerpt basis, provider provenance, structured reasoning map, and human acceptance state.

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
15. **Excerpt-aware Challenger argument review**

**Φ THINK TANK is a control room, not eight chat cards.**
