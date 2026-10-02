# Local Dossier Transparency Journal

PR 19 adds an optional persistent local transparency journal for PR 18 cryptographic dossier seals.

## Core law

**LOGGED ≠ TRUSTED TIME ≠ TRUSTED SIGNER ≠ TRUE DECISION.**

A valid journal proves that its current entries form the expected local SHA-256 hash chain.

It does not establish:
- trusted wall-clock time
- external publication
- external witnessing
- real-world signer identity
- certificate-authority trust
- factual truth
- decision correctness

## Configuration

The journal is disabled by default.

Configure a local file path:

```
DOSSIER_TRANSPARENCY_LOG_FILE=.secrets/dossier-transparency.jsonl
```

The bridge creates the parent directory when needed.

The file contains public integrity metadata, not the Ed25519 private key.

## Entry format

Each line is one DossierTransparencyReceipt.

An entry binds:
- dossier id
- seal id
- dossier SHA-256
- signer public-key fingerprint
- journal sequence
- previous entry SHA-256
- local append time
- canonicalization label
- trust labels

The genesis previous-entry value is 64 zeroes.

Entry ids have the form:

```
TLOG-000001-<first 12 hex chars of entry SHA-256>
```

## Hash basis

The entry SHA-256 is computed over stable canonical JSON containing:
- schema version
- dossier/seal linkage
- dossier digest
- signer-key fingerprint
- journal metadata
- sequence
- previous-entry hash
- local append time
- clock/trust labels
- verified-at-append marker

The entry id itself is derived after hashing and is not part of the hash basis.

## Append flow

Canonical flow:

```
OPERATOR REQUEST
  → verify entire existing journal
  → reject duplicate seal
  → build next hash-linked entry
  → append one JSONL line
  → verify entire resulting journal
  → TOOL COMPLETION EVENT
```

If the existing journal is malformed or its hash chain is broken, append fails closed.

## Event contract

Governed events:
- `dossier.transparency.requested` — operator
- `dossier.transparency.completed` — tool
- `dossier.transparency.failed` — tool

The kernel enforces:
- no transparency mutation during active governed execution
- existing dossier + seal linkage
- one accepted transparency entry per seal
- supported metadata/trust labels
- SHA-256 field shape
- deterministic entry-id shape
- sequence/hash continuity for entries accepted in the current room state
- one terminal result per operator request
- deterministic replay

The Node bridge owns actual SHA-256 journal verification and file I/O.

## Persistent-journal behavior

The journal may predate the current browser session.

That means the first transparency receipt accepted into a fresh room can legitimately have a sequence greater than 1.

After the room has accepted one journal receipt, later receipts must extend that accepted sequence/hash exactly.

## UI

The Decision Dossier panel shows:
- journal READY / DISABLED / CORRUPT status
- current entry count
- latest linked transparency entry
- entry SHA-256
- previous-entry SHA-256
- seal linkage
- local-clock warning
- trust label
- APPEND SEAL TO JOURNAL action

The dossier export includes `transparencyEntries`.

## Security boundary

The local journal is tamper-evident, not externally immutable.

A machine owner who controls the filesystem can replace the entire journal with a different internally valid chain.

That is why PR 19 makes no external immutability or trusted-time claim.

A later rung can add external checkpoints, RFC 3161-style timestamping, or independent witnesses without changing the PR 19 receipt semantics.

## Non-goals

PR 19 does not:
- create a blockchain
- establish trusted timestamps
- publish hashes to a public service
- use a certificate authority
- establish signer identity
- change Reality Gate scoring
- change Claim Policy
- change Argument Policy
- authorize synthesis
- make a decision true
