# Φ THINK TANK Architecture

## Core rule

**If a light changes, a sequenced event explains why.**

The UI is a projection of one event-sourced session state. Simulation and real providers emit the same canonical event shape.

## Event kernel

Every event carries session, sequence, seed, source, mode, phase, and deterministic pre/post projection fingerprints.

Replay validates each transition before applying it. The same ledger from the same initial state must reconstruct the same visible room.

See [EVENT_KERNEL.md](EVENT_KERNEL.md).

## Human operator authority

The Operator Rail is permanent UI. Prompt submission, mode selection, abort, pin/unpin, seat availability, provider-health sync, and force-synthesis belong to the operator surface.

Operational controls do not bypass the ledger.

During SIM or LIVE execution, mutating controls lock while ABORT remains available.

## Roles are not seats

Cognitive roles:
- Vessie Prime
- Dreamer
- Builder
- Challenger
- Archivist

Provider/model seats:
- OpenAI seat
- Kimi seat
- Local Brain

Provider adapters staff seats. They do not redefine cognitive roles.

## Crane Fly assignment engine

Crane Fly owns deterministic role ↔ seat staffing for the active collaboration mode.

Operator pins are hard constraints. AUTO routing does not override them.

Routing occurs after the operator prompt and before governed session start.

See [CRANE_FLY.md](CRANE_FLY.md).

## Provider adapters

PR 7 adds a local-only provider bridge.

The browser never receives OpenAI or Kimi API keys.

Current transports:
- Ollama `/api/tags` + `/api/chat`
- OpenAI Responses API
- Kimi OpenAI-compatible chat completions

Provider health is observational until the operator explicitly syncs it into Crane Fly.

LIVE provider responses emit canonical `source: provider` events.

Provider failure emits a canonical fault path rather than bypassing the scheduler.

No public unauthenticated key-holding proxy is shipped.

See [PROVIDERS.md](PROVIDERS.md).

## Modes + scheduler

Each mode locks:
- active role set
- speaker queue
- round cap
- timeout
- synthesis trigger
- gate behavior
- output label
- objection requirement

The kernel rejects histories that violate that schedule.

See [MODE_GOVERNANCE.md](MODE_GOVERNANCE.md).

## Semantic motion

Motion is a projection of accepted events, not a second state machine.

Assignment, SIM, and LIVE provider events use the same route visualization:

`SEAT → Φ COMMONLINE → ROLE`

Hidden tabs pause FX. Reduced motion preserves semantic state.

See [MOTION_LAYER.md](MOTION_LAYER.md).

## Reality Gate evidence engine

Initial evidence threshold: 0.75.

LIVE sessions now compute a deterministic evidence packet across provider provenance, role coverage, seat diversity, challenge coverage, and explicit external support.

Model output alone is capped at 0.65.

A single operator-attested external reference is capped at 0.74.

Operator-created evidence cannot self-declare machine verification.

The event kernel recomputes scored LIVE gate receipts and rejects mismatched scores or breakdowns.

Reality Gate is a provenance/support governance mechanism, not a factual truth oracle.

See [EVIDENCE_GATE.md](EVIDENCE_GATE.md).

## Machine-verified evidence retrieval

PR 9 adds the first governed tool allowed to emit `machine-verified` evidence.

The operator authorizes a URL fetch. The local bridge:
- validates the destination
- blocks private/local network targets
- pins the connection to the validated public address
- revalidates redirects
- caps bytes and redirects
- hashes the accepted response body

The canonical evidence receipt stores metadata + SHA-256, not the fetched body.

Only `source: tool` evidence with a complete retrieval receipt may claim `machine-verified`.

This proves retrieval provenance, not factual truth.

See [MACHINE_EVIDENCE.md](MACHINE_EVIDENCE.md).

## Claim registry + source bindings

PR 10 adds a canonical semantic graph:

`CLAIM ← SUPPORTS / CONTRADICTS / CONTEXT ← EVIDENCE`

Claims and bindings are operator-authorized, fingerprinted, and replayable.

Claim status is derived from current bindings rather than directly assigned.

Bound evidence and bound claims cannot be silently deleted. Relation changes require explicit unbind/rebind events.

PR 10 does not change Reality Gate scoring. It establishes the graph that future governed research/search can populate and analyze.

See [CLAIM_BINDINGS.md](CLAIM_BINDINGS.md).

## Governed research / search

PR 11 adds claim-scoped source discovery through an optional local/admin-configured SearXNG adapter.

The canonical flow is:

`CLAIM → SEARCH REQUEST → QUARANTINED CANDIDATES → MACHINE RETRIEVAL → EVIDENCE → CLAIM BINDING`

Search candidates are fingerprinted and replayable but contribute zero to Reality Gate.

Promotion reuses the PR 9 evidence verifier and preserves candidate lineage.

Duplicate evidence URIs and duplicate machine-content SHA-256 digests are rejected so rediscovery cannot inflate evidence breadth.

See [GOVERNED_RESEARCH.md](GOVERNED_RESEARCH.md).

## Challenger claim coverage audits

PR 12 adds immutable deterministic structural reviews of the claim/evidence graph.

The operator requests review; the system recomputes coverage from canonical evidence/bindings; the kernel independently verifies the receipt.

Coverage snapshots record provenance counts, directional relation counts, research lineage, structural flags, and a basis fingerprint.

Current graph state can therefore be compared with the latest immutable review and shown as FRESH or STALE.

PR 12 does not alter Reality Gate policy.

See [CHALLENGER_COVERAGE.md](CHALLENGER_COVERAGE.md).

## Claim-aware governance

PR 13 composes claim-review policy with the existing numeric Reality Gate at synthesis time.

Each mode owns a frozen claim policy. Every normal synthesis resolution carries a deterministic ClaimGovernanceReport that the kernel recomputes from canonical claims, bindings, and Challenger reviews.

The numeric evidence score is unchanged.

A high Reality Gate score cannot bypass missing/stale claim-review requirements in rigorous modes.

BUILD degrades to DRAFT on claim-policy failure; TRIO, COUNCIL, DEBATE, and AUDIT fail closed. SOLO and DREAM remain informational.

See [CLAIM_GOVERNANCE.md](CLAIM_GOVERNANCE.md).

## Hash-locked source excerpts

PR 14 adds exact source-text provenance above machine-verified evidence.

The bridge re-fetches a verified source, requires the bytes to match the original SHA-256, derives deterministic text projection v1, and returns only a transient preview until the operator pins a bounded character range.

Pinned excerpts are canonical, replayable tool receipts carrying source, projection, and excerpt digests.

Excerpt mutations become part of the Challenger review basis and invalidate current authorization.

PDF remains verifiable evidence but is explicitly not text-projectable in this rung.

See [SOURCE_EXCERPTS.md](SOURCE_EXCERPTS.md).

## PR ladder

1. ✅ Room shell + operator authority
2. ✅ Terminal identity + speech viewport
3. ✅ Event kernel + deterministic replay
4. ✅ Modes + scheduler + governance
5. ✅ Semantic motion layer
6. ✅ Crane Fly role-seat assignment engine
7. ✅ Provider adapters + LIVE execution
8. ✅ Reality Gate evidence engine
9. ✅ Machine-verified evidence retrieval
10. ✅ Claim registry + claim-to-source binding
11. ✅ Governed research / search
12. ✅ Challenger claim coverage audits
13. ✅ Claim-aware governance policy
14. Hash-locked source excerpts

Future work can add excerpt-aware provider argument review, proper PDF extraction, authenticated remote deployment, richer provider discovery, streaming, tool execution, and voice without changing the core event contract.
