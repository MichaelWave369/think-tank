# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 19 — Local Dossier Transparency Journal**

The Think Tank can now append cryptographically sealed decision dossiers to an optional persistent local JSONL journal whose entries are SHA-256 hash-linked.

PR 19 adds:
- operator-authorized transparency append events
- persistent local JSONL journal storage
- SHA-256 entry hashing
- previous-entry hash chaining
- duplicate-seal rejection
- full-chain verification before every append
- full-chain verification after every append
- explicit local-clock / local-journal trust labels
- governed replayable transparency receipts
- Decision Dossier transparency UI
- dossier export with transparency receipts
- bridge and kernel tamper-detection tests

### Important semantic rule

**LOGGED ≠ TRUSTED TIME ≠ TRUSTED SIGNER ≠ TRUE DECISION.**

The journal proves local hash-chain continuity for the entries it contains. It does not prove that the local clock is trustworthy, that the journal was externally witnessed, that a key owner has a real-world identity, or that the decision is factually correct.

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
- [Cryptographic Dossier Sealing](docs/CRYPTOGRAPHIC_SEALING.md)
- [Local Dossier Transparency Journal](docs/TRANSPARENCY_JOURNAL.md)

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

Every normal synthesis carries a deterministic dossier; it can be Ed25519-sealed and the seal can be appended to a persistent local SHA-256 transparency journal.

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
17. ✅ Synthesis decision dossier
18. ✅ Cryptographic dossier sealing
19. **Local dossier transparency journal**

**Φ THINK TANK is a control room, not eight chat cards.**
