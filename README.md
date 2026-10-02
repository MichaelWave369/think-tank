# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 30 — Publisher Origin Identity Attestation**

The Think Tank can now derive each RPUB retrieval origin's fixed .well-known identity URL, retrieve a signed phi-publisher-identity-v1 descriptor, verify its Ed25519 key/signature, and ledger a POID receipt.

PR 30 adds:
- fixed /.well-known/phi-publisher-identity.json discovery
- RPUB/historical-package validation before identity retrieval
- pinned public HTTPS identity fetch with no credentials or redirects
- Ed25519 descriptor signature verification
- SPKI public-key fingerprint verification
- self-attested publisher/admin-domain claims
- canonical POID receipts with explicit non-authority flags
- key rotation with duplicate exact-descriptor rejection
- publisher identity keygen + signing helpers
- publisher-origin identity UI + dossier export
- bridge version 0.14.0
- crypto/origin/tamper/kernel/replay tests

### Important semantic rule

**VERIFIED ORIGIN KEY ≠ VERIFIED REAL-WORLD OPERATOR ≠ OPERATOR INDEPENDENCE ≠ CONTENT TRUE.**

A verified POID receipt proves that one exact RPUB origin served a descriptor signed by one Ed25519 key making specific publisher/administrative claims. It does not verify the legal identity behind those claims or prove that two keys represent independent operators.

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
- [Assurance-Gated Release Manifest](docs/ASSURANCE_GATED_RELEASE.md)
- [Cryptographic Release Sealing](docs/CRYPTOGRAPHIC_RELEASE_SEALING.md)
- [RFC 3161 Trusted Release Timestamp](docs/RFC3161_RELEASE_TIMESTAMP.md)
- [Verified External Release Publication](docs/RELEASE_PUBLICATION.md)
- [Release Publication Durability Audit](docs/RELEASE_DURABILITY.md)
- [Release Availability Assurance Policy](docs/RELEASE_AVAILABILITY_ASSURANCE.md)
- [Publisher Origin Identity Attestation](docs/PUBLISHER_ORIGIN_IDENTITY.md)

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

Every normal synthesis carries a deterministic dossier; it can be sealed, journaled, checkpointed, witnessed, time-attested, externally published, evaluated against explicit provenance and availability policies, authorized for governed release/export, Ed25519-sealed, RFC 3161 time-attested, externally published as an exact verified release package, re-audited for later public availability, and linked to signed self-attested identity claims served by publication origins.

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
23. ✅ Provenance assurance policy
24. ✅ Assurance-gated release manifest
25. ✅ Cryptographic release sealing
26. ✅ RFC 3161 trusted release timestamp
27. ✅ Verified external release publication
28. ✅ Release publication durability audit
29. ✅ Release availability assurance policy
30. **Publisher origin identity attestation**

**Φ THINK TANK is a control room, not eight chat cards.**
