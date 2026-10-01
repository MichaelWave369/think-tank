# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 9 — Machine-Verified Evidence Retrieval**

The Evidence Packet can now independently retrieve public HTTP/S resources through the local governed bridge and record cryptographic provenance receipts.

PR 9 adds:
- operator-authorized URL verification requests
- governed `tool` event source
- local bridge `POST /evidence/fetch`
- public-network-only retrieval policy
- loopback/private/link-local/metadata target rejection
- DNS-rebinding defense by pinning connections to validated IPs
- redirect revalidation
- content-type allowlist
- response byte cap
- redirect cap
- SHA-256 digest of accepted response bytes
- canonical retrieval metadata
- machine-verified evidence display in the room
- tool failure receipts that add no evidence
- kernel-only acceptance of complete governed tool receipts
- exact replay of machine evidence
- dedicated bridge network-policy tests

### Important semantic rule

**MACHINE-VERIFIED means retrieved + hashed + provenance-recorded.**

It does **not** mean the source is correct, trustworthy, independent, or sufficient.

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

If evidence changes the Reality Gate, a replayable provenance receipt explains where that evidence came from.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly assignments
7. ✅ Provider adapters + LIVE execution
8. ✅ Reality Gate evidence engine
9. **Machine-verified evidence retrieval**

**Φ THINK TANK is a control room, not eight chat cards.**
