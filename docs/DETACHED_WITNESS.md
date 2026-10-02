# Portable Transparency Checkpoints + Detached Witnesses

PR 20 adds an independent witnessing layer above the PR 19 local transparency journal.

## Core law

**WITNESSED ≠ TRUSTED WITNESS ≠ TRUSTED TIME ≠ TRUE DECISION.**

A verified witness receipt proves that one Ed25519 private key signed one exact transparency checkpoint.

It does not prove:
- who owns that private key
- that the witness is trustworthy
- that the witness was physically remote
- that the claimed witness time is authoritative
- that the underlying dossier is factually correct
- that synthesis should have been authorized

## Why detached witnessing

The Think Tank bridge must not hold the witness private key.

If the same bridge that creates the journal also owns the witness key, the second signature adds very little independence.

PR 20 therefore uses a portable handoff:

```
LOCAL JOURNAL HEAD
  → PORTABLE CHECKPOINT
  → EXPORT JSON
  → INDEPENDENT MACHINE / PROCESS
  → DETACHED Ed25519 WITNESS RECEIPT
  → IMPORT RECEIPT
  → THINK TANK VERIFIES PUBLIC SIGNATURE
  → GOVERNED WITNESS RECEIPT
```

## Checkpoint receipt

A DossierTransparencyCheckpoint stores:
- checkpoint id
- tool/canonicalization
- journal entry count
- journal head entry id
- journal head SHA-256
- checkpoint SHA-256
- local creation time
- `untrusted-local-clock`
- `portable-local-checkpoint`

The checkpoint can only be created for the latest transparency entry accepted by the current room.

Checkpoint ids have the form:

```
CHK-000123-<checkpoint SHA-256 prefix>
```

## Checkpoint digest

The SHA-256 digest covers stable canonical JSON containing:
- schema version
- checkpoint tool/canonicalization
- journal entry count
- head entry id
- head SHA-256
- creation time
- clock label
- trust label

The id and digest field are derived after hashing and are not recursively included in the hash basis.

## Independent witness tools

Generate a witness keypair on the independent witness machine:

```
npm run witness:keygen -- witness-private.pem witness-public.pem
```

Sign an exported checkpoint:

```
npm run witness:sign -- checkpoint.json witness-private.pem "witness-label" witness.json
```

The private witness key should remain on that independent machine.

Do not copy it into:
- `.env`
- the Think Tank bridge
- the browser
- exported dossier packages
- Git

The returned witness JSON contains public verification material only.

## Detached witness receipt

A DossierTransparencyWitnessReceipt stores:
- witness id
- checkpoint id
- Ed25519 algorithm
- json-stable-v1 canonicalization
- checkpoint SHA-256
- witness public key PEM
- public-key SHA-256 fingerprint
- Base64 signature
- claimed witness time
- witness label
- `self-attested-external-witness-key`

Witness ids are deterministic from checkpoint id + public-key fingerprint prefix.

Multiple independent keys may witness the same checkpoint.

The same witness key may be accepted only once per checkpoint.

## Signed envelope

The Ed25519 signature binds:
- checkpoint id
- algorithm
- canonicalization
- checkpoint SHA-256
- public-key fingerprint
- claimed witness time
- witness label
- trust label

The signature does not bind an externally verified identity.

## Verification

The Think Tank bridge:
1. recomputes the checkpoint SHA-256
2. checks the deterministic checkpoint id
3. parses the witness Ed25519 public key
4. recomputes the public-key fingerprint
5. reconstructs the signed envelope
6. verifies the detached Ed25519 signature

Only a successful verification is stored as an accepted witness.

## Governed event flow

Checkpoint:
- `dossier.checkpoint.requested` — operator
- `dossier.checkpoint.completed` — tool
- `dossier.checkpoint.failed` — tool

Witness:
- `dossier.witness.requested` — operator submission
- `dossier.witness.completed` — tool verification
- `dossier.witness.failed` — tool failure / invalid signature

The kernel enforces:
- checkpoint binds the latest accepted journal head
- one checkpoint per accepted head
- supported checkpoint metadata
- deterministic checkpoint id shape
- witness references an existing checkpoint
- supported witness metadata
- deterministic witness id shape
- one accepted witness per checkpoint/key fingerprint
- verification receipt linkage
- matching operator submission
- one terminal result per request
- no checkpoint/witness mutation during active governed execution
- deterministic replay

Actual SHA-256 and Ed25519 math remain in the Node bridge / independent signing tool.

## Replay fingerprint hardening

PR 20 also includes the PR 19 transparency state and the new checkpoint/witness arrays in the canonical projection fingerprint.

This closes the gap where transparency receipts were replayed into state but were not included in the pre/post projection checksum.

## UI

The Decision Dossier panel provides:
- FREEZE JOURNAL CHECKPOINT
- EXPORT CHECKPOINT
- IMPORT WITNESS RECEIPT
- checkpoint digest/head metadata
- witness label/key fingerprint
- local verification time
- explicit trust warnings

The dossier JSON export includes linked:
- transparency entries
- checkpoints
- witnesses
- witness verification receipts

## Non-goals

PR 20 does not:
- run a public transparency service
- prove geographic separation
- establish witness identity
- assign witness reputation or trust
- provide RFC 3161 or other trusted timestamps
- publish checkpoints automatically
- create a blockchain
- change Reality Gate scoring
- change Claim Policy
- change Argument Policy
- authorize synthesis
- make a decision true
