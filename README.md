# Φ THINK TANK

**Multi-Mind Terminal for Super Φ.Vessel**

A governed, event-sourced multi-mind control room. Cognitive roles are staffed by model/provider seats, coordinated through Commonline, routed by Crane Fly, evaluated through the Reality Gate, and kept under explicit human operator authority.

## Current rung

**PR 7 — Provider Adapters + LIVE Execution**

The Think Tank can now execute real provider turns through the same governed event path used by simulation.

PR 7 adds:
- local companion provider bridge
- real Ollama model discovery + chat
- server-side OpenAI Responses adapter
- server-side Kimi OpenAI-compatible adapter
- zero provider secrets in browser state/storage/bundles
- remote providers disabled until explicit key + model configuration
- provider-neutral cognitive role prompts
- Provider Bridge console with health/model status
- explicit provider health → Crane Fly sync
- LIVE execution alongside deterministic SIM
- provider model/latency/request receipt metadata
- abortable in-flight provider requests
- canonical `provider.failed` governance path
- fail-closed LIVE Reality Gate when no evidence scorer exists
- 1200-token default remote/local output guardrail
- provider bridge syntax validation in CI
- automated LIVE replay and failure tests

### Local-first setup

    cp .env.example .env
    npm install
    npm run bridge

In another terminal:

    npm run dev

No remote API key is required for Ollama.

See:
- [Architecture](docs/ARCHITECTURE.md)
- [Terminal Contract](docs/TERMINAL_CONTRACT.md)
- [Event Kernel](docs/EVENT_KERNEL.md)
- [Mode Governance](docs/MODE_GOVERNANCE.md)
- [Motion Layer](docs/MOTION_LAYER.md)
- [Crane Fly](docs/CRANE_FLY.md)
- [Providers](docs/PROVIDERS.md)

Verification:

    npm test
    npm run bridge:check
    npm run build

## Architectural law

> **If a light changes, a sequenced event explains why.**

Real provider output changes the event emitter, not the cognitive role, scheduler, routing, governance, motion, or ledger contracts.

## Build ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly assignments
7. **Provider adapters + LIVE execution**

**Φ THINK TANK is a control room, not eight chat cards.**
