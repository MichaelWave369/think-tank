# Cryptographic Dossier Sealing

PR 18 adds optional persistent Ed25519 signatures to PR 17 synthesis decision dossiers.

## Core law

**VALID SIGNATURE ≠ TRUSTED SIGNER ≠ TRUE DECISION.**

A valid seal proves:

- the sealed dossier canonicalizes to the recorded SHA-256
- the Ed25519 signature verifies under the included public key
- the included public key fingerprints to the recorded key id

It does not prove:

- who owns that key
- that the signer is externally trusted
- that the underlying evidence is true
- that the synthesis was correct
- that a human override was wise

PR 18 labels its trust model:

SELF-ATTESTED LOCAL KEY

External identity attestation is deliberately left for a later rung.

## Two integrity systems

The Think Tank now has two different integrity mechanisms.

### Replay checksum

Existing:

fnv1a32:...

Purpose:
- deterministic state replay
- fast projection/basis equality checks

Not cryptographic.

### Dossier seal

PR 18:

SHA-256 + Ed25519

Purpose:
- cryptographic dossier-content integrity
- portable verification outside the original browser state

These mechanisms complement each other and must not be conflated.

## Persistent signer

Sealing is optional and disabled by default.

Generate a persistent keypair once:

    npm run dossier:keygen

Default output:

    .secrets/dossier-ed25519-private.pem
    .secrets/dossier-ed25519-public.pem

The .secrets directory is gitignored.

Then configure .env:

    DOSSIER_SIGNING_PRIVATE_KEY_FILE=<private key path>
    DOSSIER_SIGNING_KEY_LABEL=local-bridge

The bridge does not automatically generate an ephemeral signing identity.

If no key is configured:

SEALING DISABLED

This prevents signer identity from silently changing on restart.

## Private-key boundary

The private key remains in the local bridge process.

The browser receives only:

- signature
- public key
- public-key fingerprint
- dossier SHA-256
- signer label
- signature metadata

The private key is never placed in:
- browser state
- event history
- dossier export
- public repository

## Canonicalization

Before hashing, the bridge uses:

json-stable-v1

Rules:
- object keys sorted recursively
- array order preserved
- JSON scalar representation preserved

The canonical dossier is hashed with SHA-256.

## Seal envelope

The Ed25519 signature covers a canonical envelope containing:

- schemaVersion
- dossierId
- algorithm
- canonicalization
- dossier digest SHA-256
- public-key fingerprint SHA-256
- signedAt
- signerLabel
- trust model

The metadata cannot therefore be changed independently while reusing the same signature.

## DossierSealReceipt

A canonical seal receipt stores:

- seal id
- dossier id
- tool: ed25519-dossier-sealer
- algorithm: Ed25519
- canonicalization: json-stable-v1
- dossier SHA-256
- public key PEM
- public-key fingerprint SHA-256
- signature Base64
- signedAt
- signer label
- trust: self-attested-local-key

Seal ids include the dossier id and signer-key fingerprint prefix.

This permits later multi-signer support.

## Multi-signer law

A dossier may carry multiple seals from different public-key fingerprints.

The same signer key may seal a given dossier only once.

This allows:
- key rotation
- later external attestors
- multiple independent signers

without pretending that all signatures represent one identity.

## Governed event flow

Signing:

    dossier.seal.requested      OPERATOR
    dossier.seal.completed      TOOL

Verification:

    dossier.verify.requested    OPERATOR
    dossier.verify.completed    TOOL

Failures are also explicit tool events.

Every request has one terminal result.

## Cryptographic verification

POST /dossier/verify receives:
- canonical dossier
- stored seal

The bridge:

1. canonicalizes the dossier
2. recomputes dossier SHA-256
3. checks dossier id
4. parses the public key
5. requires Ed25519
6. recomputes public-key fingerprint
7. reconstructs the signed envelope
8. verifies the Ed25519 signature

Verification can be performed without the private key.

## Verification receipt

DossierSealVerificationReceipt stores:

- verification id
- dossier id
- seal id
- verifier tool
- algorithm
- digest SHA-256
- public-key fingerprint
- verified true/false
- verifiedAt

The kernel requires those fields to match the stored seal.

Actual Ed25519 verification is performed by the bridge.

## Kernel vs crypto responsibilities

The synchronous event kernel enforces:

- operator-authorized requests
- tool-originated results
- existing dossier/seal references
- supported receipt metadata
- digest/fingerprint shape
- request lifecycle
- one seal per dossier/key
- verification receipt linkage
- replay integrity

The local Node bridge performs:

- SHA-256
- private-key loading
- Ed25519 signing
- public-key derivation
- Ed25519 verification

This keeps cryptographic primitives out of the synchronous UI state reducer.

## Sign endpoint self-check

The signing endpoint verifies every signature it generates before returning it.

A generated seal that fails its own verification is not returned.

## UI states

The Decision Dossier panel exposes:

- SIGNER DISABLED
- UNSEALED
- SEALED · UNVERIFIED
- VERIFIED
- INVALID

It displays:
- signer label
- dossier SHA-256
- key fingerprint
- algorithm/canonicalization
- trust model
- signing time
- latest verification state/time

## Export

TEAR / EXPORT DOSSIER now exports:

- dossier
- linked human override
- all dossier seals
- all stored verification receipts

No private key is exported.

## Trusted time limitation

signedAt and verifiedAt are local bridge clock observations.

PR 18 does not provide:
- trusted timestamp authority
- blockchain anchoring
- transparency log inclusion
- remote notarization

## Non-goals

PR 18 does not:

- establish external signer identity
- provide certificate authority trust
- add trusted timestamps
- change synthesis authorization
- add Reality Gate points
- sign entire event ledgers
- sign fetched source bodies independently
- add remote attestation
