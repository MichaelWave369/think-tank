# TT-35 R8 · Offline Independent Kernel Replay Verification

**New command:** `npm run council:verify -- PATH_TO_LEDGER.json [PATH_TO_DOSSIER.json]`

Build the existing ThinkTank CLI using `npm run council:build`. The verifier uses the actual `src/kernel/eventKernel.ts` to **replay every ledger event from `createInitialState()`**, including the kernel's sequence, seed, pre/post projection fingerprints, claim governance, argument governance, and synthesis dossier checks. It compares the reconstructed fingerprint to the ledger's recorded self-reported final fingerprint. When a dossier is supplied, it compares the exact canonical dossier content with the reconstructed, kernel-produced final dossier.

## Operator workflow

1. Complete a deliberately approved local council with `council:run`, or select previously generated outputs.
2. Invoke `npm run council:verify -- /absolute/path/council-...-ledger.json /absolute/path/council-...-decision-dossier.json`. The dossier argument may be omitted if the run produced none.
3. On passing verification, the command creates a fresh restricted-permission file under `local-council-artifacts/replay-verification-*.json` and prints `LOCAL_COUNCIL_VERIFICATION=...`. **Verification makes no model calls.**
4. If an event checksum or state transition is tampered with, verification exits nonzero and does not produce a PASS report. A mock local-bridge acceptance test tests this failure path.

The verification JSON includes:

- `schema = phi-thinktank-local-council-verification.v0.1`
- `result = KERNEL_REPLAY_PASS`
- the source `ledgerSha256` and optional `dossierSha256`, both computed from **exact source file bytes**
- session, mode, model, contract digest, event count, provider-turn count
- independently reconstructed final state fingerprint, dossier reference and optional exact dossier match
- explicit `authGranted = false`, `externalDone = false`, `truthAuthority = false`, `signerAuthenticated = false`, `independentlyAuthenticated = false`

## Trust boundary

This is actual local **deterministic kernel replay**, unlike a browser viewer that merely reads `replay.exact=true` from a JSON file. However, replay proves only that a ledger's events form a valid sequence under the installed ThinkTank kernel and that the optional dossier matches the reconstructed state.

It does **not** prove that a model truly ran, that the recorded provider text is factual, or that the report is from a trusted computer. FNV replay fingerprints are noncryptographic; SHA-256 binds the report to local byte content, not its author. The new verification report is **unsigned and self-attested**. A malicious actor controlling both source files and report can still fabricate a matching set. Do not treat a passing local receipt as independent signer identity, publication, or real-world truth.

No networking, provider execution, credentials, external tools, elevated privilege, or automatic agent action is involved in `council:verify`. This is a local file-only read with an additive receipt written by `wx`/0600.

## Acceptance

- `npm run build`
- `npm run test`
- `npm run council:build`
- `node --test scripts/local-council-cli.node.mjs`

The existing synthetic local bridge test now invokes the real verifier and checks that it creates a matching PASS report, the raw artifact SHA-256 matches, and a tampered event fingerprint causes the kernel replay to fail without additional model requests.

**Ledger Above Ego. Proof of replay, never proof of truth.**
