# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 23 — Provenance Assurance Policy**

The Think Tank can now evaluate explicit deterministic provenance policies over the cryptographic, journal, checkpoint, witness, timestamp, and publication receipts already accepted into canonical state.

PR 23 adds:
- non-numeric provenance assurance policies
- integrity / witnessed / time-attested / published / full-provenance profiles
- coherent single-checkpoint chain evaluation
- explicit MET / MISSING requirement receipts
- deterministic provenance-basis fingerprints
- FRESH / STALE assurance reports
- current / historical journal-head labeling
- hard-coded truthAuthority: false
- operator-authorized assurance evaluation events
- exact kernel recomputation + replay verification
- Decision Dossier assurance selector/UI + export
- policy/evaluator/kernel tests

### Important semantic rule

**POLICY SATISFIED ≠ CONTENT TRUE ≠ DECISION CORRECT.**

A satisfied policy means its required provenance layers exist in one coherent linked chain. It does not convert provenance evidence into factual evidence, universal trust, or decision authority.

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
- [Portable Checkpoints + Detached Witnesses](docs/DETACHED_WITNESS.md)
- [RFC 3161 Timestamp Attestation](docs/RFC3161_TIMESTAMP.md)
- [Verified External Checkpoint Publication](docs/CHECKPOINT_PUBLICATION.md)
- [Provenance Assurance Policy](docs/PROVENANCE_ASSURANCE.md)

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

Every normal synthesis carries a deterministic dossier; it can be sealed, journaled, checkpointed, witnessed, time-attested, externally published, and then evaluated against an explicit non-numeric provenance assurance policy.

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
19. ✅ Local dossier transparency journal
20. ✅ Portable checkpoints + detached witnesses
21. ✅ RFC 3161 trusted timestamp attestation
22. ✅ Verified external checkpoint publication
23. **Provenance assurance policy**

**Φ THINK TANK is a control room, not eight chat cards.**
