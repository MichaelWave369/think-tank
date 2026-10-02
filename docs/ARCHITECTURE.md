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

## Excerpt-aware Challenger argument review

PR 15 adds a provider-generated reasoning layer above exact source excerpts.

The review basis is deterministic and fingerprinted, while the reasoning content remains explicitly provider-authored.

The provider must account for every eligible excerpt exactly once and may not supply quotation text. Canonical quotes are resolved from EvidenceExcerpt state.

Reviews enter as DRAFT and require explicit operator acceptance or dismissal.

Argument reviews do not alter Reality Gate scoring or Claim Policy in PR 15.

See [ARGUMENT_REVIEW.md](ARGUMENT_REVIEW.md).

## Argument-map governance

PR 16 adds a third independent synthesis check beside Reality Gate and Claim Policy.

COUNCIL, DEBATE, and AUDIT require fresh operator-accepted Challenger argument maps for claims that currently have pinned exact excerpts on bound evidence.

SOLO, TRIO, DREAM, and BUILD keep Argument Policy informational.

Every normal synthesis event carries a deterministic ArgumentGovernanceReport that the kernel recomputes from canonical argument-review state.

Provider analysis still contributes zero numeric Reality Gate points.

See [ARGUMENT_GOVERNANCE.md](ARGUMENT_GOVERNANCE.md).

## Synthesis decision dossier

PR 17 packages every normal synthesis result into one deterministic historical receipt.

The dossier freezes:
- mode and operator prompt
- normal completed/withheld outcome
- Reality Gate
- Claim Policy
- Argument Policy
- claim/binding/evidence/excerpt basis
- structural-review fingerprints
- provider argument-map fingerprints
- current-run provider turn provenance
- decision-basis fingerprint

FORCE SYNTHESIS does not rewrite the dossier. It appends a separate linked DecisionOverrideReceipt.

Dossiers remain historical state across later mutations and runs.

See [DECISION_DOSSIER.md](DECISION_DOSSIER.md).

## Cryptographic dossier sealing

PR 18 adds an optional cryptographic integrity layer above portable PR 17 dossiers.

The local bridge:
- loads an operator-configured persistent Ed25519 private key
- stable-canonicalizes the dossier
- computes SHA-256
- signs a metadata-bound seal envelope
- returns only public verification material

The event kernel stores governed seal/verification receipts and enforces request/replay structure.

Actual Ed25519 signing and verification remain in the Node bridge.

The trust model is explicitly self-attested local key. PR 18 does not establish external signer identity or trusted time.

See [CRYPTOGRAPHIC_SEALING.md](CRYPTOGRAPHIC_SEALING.md).

## Local dossier transparency journal

PR 19 adds an optional persistent append-only-by-convention journal above PR 18 seals.

The local bridge stores one JSON object per line. Each entry binds:
- dossier id
- seal id
- dossier SHA-256
- signer-key SHA-256 fingerprint
- journal sequence
- previous entry SHA-256
- local append time

The bridge verifies the entire existing chain before append, rejects duplicate seals, appends exactly one new entry, then verifies the entire chain again.

The canonical event ledger stores the returned transparency receipt, so the room can replay exactly which journal commitment was accepted.

The journal clock is explicitly labeled untrusted local time. A valid local chain is not a trusted timestamp, an external witness, signer identity proof, or factual-truth proof.

See [TRANSPARENCY_JOURNAL.md](TRANSPARENCY_JOURNAL.md).

## Portable checkpoints + detached witnesses

PR 20 lets the operator freeze the latest transparency-journal head that the room has actually accepted into a portable checkpoint.

The checkpoint binds:
- journal entry count
- journal head entry id
- journal head SHA-256
- checkpoint SHA-256
- local creation time with an explicit untrusted-clock label

The checkpoint can be exported and signed by an independent Ed25519 key on another machine or process.

The Think Tank bridge never needs the witness private key. It receives only:
- the canonical checkpoint
- the detached witness receipt
- the witness public key/signature material

The bridge independently recomputes the checkpoint digest, verifies the witness key fingerprint, reconstructs the signed envelope, and verifies the Ed25519 signature.

Only a successful verification becomes a canonical witness receipt in the event ledger.

Witness identity and trusted time remain outside this rung.

See [DETACHED_WITNESS.md](DETACHED_WITNESS.md).

## RFC 3161 timestamp attestation

PR 21 adds an optional standards-based time-attestation layer for portable transparency checkpoints.

The local bridge:
1. validates the canonical checkpoint digest
2. asks OpenSSL to create an RFC 3161 SHA-256 timestamp query
3. POSTs the DER query to the operator-configured TSA URL
4. stores the returned DER timestamp reply temporarily
5. asks OpenSSL to verify the reply against the original query and configured CA/trust-anchor file
6. extracts TSA policy OID, serial number, generation time, and TSA subject
7. stores the raw token plus SHA-256 token fingerprint in a governed receipt

The browser never decides whether a token is cryptographically valid. It only accepts a tool completion receipt after the bridge verification boundary succeeds.

The configured CA file is hashed into the receipt so later exports preserve which local trust configuration was used.

This layer is optional and fail-closed. Missing OpenSSL, a missing CA file, malformed TSA replies, digest mismatch, or trust-chain failure prevents timestamp completion.

See [RFC3161_TIMESTAMP.md](RFC3161_TIMESTAMP.md).

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
14. ✅ Hash-locked source excerpts
15. ✅ Excerpt-aware Challenger argument review
16. ✅ Argument-map governance
17. ✅ Synthesis decision dossier
18. ✅ Cryptographic dossier sealing
19. ✅ Local dossier transparency journal
20. ✅ Portable checkpoints + detached witnesses
21. RFC 3161 trusted timestamp attestation

Future work can add proper PDF extraction, authenticated remote deployment, richer provider discovery, streaming, tool execution, voice, witness trust policies, public checkpoint publication, TSA trust-store management, and external signer identity attestation without changing the core event contract.
