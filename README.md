# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 18 — Cryptographic Dossier Sealing**

The Think Tank can now cryptographically seal portable decision dossiers with a persistent local Ed25519 signer while keeping replay checksums, signer identity trust, and factual truth as separate concepts.

PR 18 adds:
- optional persistent Ed25519 dossier signer
- SHA-256 dossier content digests
- json-stable-v1 canonicalization
- public-key SHA-256 fingerprints
- self-attested local signer trust label
- persistent key generation command
- private-key bridge boundary
- governed seal request/completion events
- governed verification request/completion events
- one seal per dossier per signer key
- multi-signer-ready receipt model
- signing endpoint self-verification
- independent verification without private key
- stored verification receipts
- tamper-detection tests
- Decision Dossier seal UI
- seal/verifier telemetry
- dossier export with seals + verification receipts

### Important semantic rule

**VALID SIGNATURE ≠ TRUSTED SIGNER ≠ TRUE DECISION.**

Cryptography proves content integrity under a key. External identity trust and decision correctness remain separate questions.

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

Every normal synthesis carries a deterministic dossier; PR 18 can optionally seal that portable receipt with a persistent local Ed25519 key.

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
18. **Cryptographic dossier sealing**

**Φ THINK TANK is a control room, not eight chat cards.**
