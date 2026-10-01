# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 14 — Hash-Locked Source Excerpts**

The Think Tank can now pin exact quotations from machine-verified source bytes without storing entire webpages in canonical state.

PR 14 adds:
- deterministic source text projection
- source re-fetch with original SHA-256 lock
- transient source preview
- exact character-range selection
- canonical EvidenceExcerpt receipts
- source / projection / excerpt SHA-256 lineage
- operator request → tool receipt event flow
- one terminal result per excerpt request
- source-change rejection
- 1600-character kernel excerpt cap
- evidence deletion protection while excerpts exist
- excerpt-aware Challenger review freshness
- authorization invalidation after excerpt mutation
- Source Excerpt Console
- explicit PDF extraction non-support
- expanded bridge and kernel tests

### Important semantic rule

**EXACT EXCERPT ≠ CLAIM TRUE.**

The excerpt proves exact source text provenance. Claim interpretation remains a separate binding/audit/governance step.

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

If source text is quoted, a hash-locked excerpt receipt explains exactly which verified bytes and character range produced it.

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
14. **Hash-locked source excerpts**

**Φ THINK TANK is a control room, not eight chat cards.**
