# TT / PocketMesh E1-A — Read-only synthetic Research Council receipt consumer

**Status: Offline contract adapter / SIMULATED / AUTHORITY NONE.**

This ThinkTank-only adapter is the first real code boundary receiving the `NBGPocketMesh` Research Council E1 JSON format. It does **not** connect to PocketMesh over a network, open an agent workflow, execute model inference, populate a live council, publish a dossier, or grant authority.

Upstream: [NBGPocketMesh Research Council E1](https://github.com/MichaelWave369/NBGPocketMesh/blob/main/docs/FLEET_COUNCIL_E1.md). This adapter independently validates the fixed `nbg-pocketmesh.council-evidence-exchange-e1.v0.1` envelope **without importing or modifying the upstream repo**.

## What this actually verifies

The pure reviewer `scripts/pocketmesh-e1-consumer.mjs` checks:

- Exact version, policy epoch, public synthetic origin and frozen zero-authority flags.
- Exactly three ordered, correctly typed seats: ThinkTank hypothesis challenger, PocketBrain display observer, Vessie governance reviewer.
- 40-character *declared* source SHAs and well-formed E0 parent digest equality in every seat.
- Coherent candidate Keyhole action pair (challenge+contrast, or ordinary review+display).
- SHA-256 of each receipt and the outer envelope using the upstream stable sorted-key serialization.
- No extra fields, raw prompts, tokens, memory, false provenance, model-executed flags, or runtime authority.
- Historical exchange type is fixed. Future E1 schema versions fail closed until reviewed.

The result is always `HELD_UNTRUSTED_REVIEW_ONLY` on a well-formed record. It includes a bounded categorical suggestion for review, but **never calls the live ThinkTank council, PhiServe, or any other participant**.

### Read local file explicitly

```sh
node scripts/inspect-pocketmesh-e1.mjs --file /path/to/public-synthetic-e1.json
```

The file must be an explicitly selected, local, regular nonsymlink file of at most 64 KiB. The CLI rejects invalid input and prints a bounded status without echoing raw file contents or guessed secrets. No stdin, network, automatic discovery, or writes.

```sh
node --test scripts/pocketmesh-e1-consumer.node.mjs
npm run bridge:test
```

## What this cannot verify

**An internally valid hash is not independent evidence.** Any person can construct a self-consistent synthetic bundle or change source SHA declarations and recompute the hashes. This code cannot prove that a declared GitHub commit exists, that upstream E0 code generated the bundle, that a source is independent, that a model executed, or that any physics result is true. Even valid output does not automatically become a ThinkTank Decision Dossier.

No connection or trust relationship has been established with PocketBrain, Vessie, BrainC, GAIA, Agentora, PhiMada Prime, PhiKernel or PhiShare.

## Negative controls

Tests cover altered inner and outer digests, forged approval/sharing/execution flags even when digests are recomputed, seat identity or ordering changes, private data smuggling, false scientific origins, invalid SHAs, inconsistent Keyhole actions, missing seats, symlink/oversize files, and intentional self-consistent forgery remaining unverified.

## Next gates

1. Freeze one independently generated NBGPocketMesh producer fixture with exact source hash and test it on this consumer (separate from consumer-generated fixtures). Use public synthetic data only.
2. Add operator-selected local UI preview under ThinkTank with an untrusted badge; never inject receipt strings into system prompts as instructions.
3. Add detached authenticated source provenance and strong acceptance on separately approved work before considering a real provider request.
4. Only after valid consent and PhiKernel policy can a future workflow attempt action. Upstream Agentora Fleet and PhiMada desk remain read-only/advisory unless their own explicit gated milestones add authority.

**Ledger Above Ego.**
