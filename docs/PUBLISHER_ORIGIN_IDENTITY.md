# Publisher Origin Identity Attestation

PR 30 adds a signed, externally retrieved identity-claim layer for verified release-publication origins.

## Core law

**VERIFIED ORIGIN KEY ≠ VERIFIED REAL-WORLD OPERATOR ≠ OPERATOR INDEPENDENCE ≠ CONTENT TRUE.**

A successful POID receipt means:
- a historical RPUB already exists
- Think Tank reconstructed and revalidated the exact historical RPUB package
- Think Tank derived the RPUB retrieval origin
- Think Tank fetched that origin's fixed publisher-identity descriptor
- the descriptor was served over the constrained public HTTPS boundary
- the descriptor named the exact RPUB retrieval origin
- the descriptor carried an Ed25519 public key
- the public-key fingerprint matched the key bytes
- the descriptor's Ed25519 signature verified over the exact canonical identity envelope
- the verified descriptor was recorded in canonical replay state

It does not mean:
- the publisher id is a verified legal identity
- the publisher label is externally validated
- the administrative-domain claim is externally validated
- two different keys are two different people or companies
- two different administrative-domain claims are independently administered
- the publisher endorses the release
- the release package is true

## Why this layer exists

PR 29 intentionally treats distinct HTTPS origins only as topology evidence.

Two origins may still be controlled by:
- one person
- one company
- one deployment account
- one infrastructure provider
- one compromised administrator

PR 30 does not pretend to solve real-world identity.

Instead it introduces a narrower fact:

> What signed identity claim is this exact RPUB origin publicly serving?

That evidence can support later policy without quietly turning URL diversity into human/operator diversity.

## Protocol

Protocol identifier:

    phi-publisher-identity-v1

Every participating RPUB retrieval origin serves:

    /.well-known/phi-publisher-identity.json

Example:

    https://public.example.org/.well-known/phi-publisher-identity.json

The identity URL is derived by Think Tank from the RPUB retrieval origin.

The operator/browser cannot supply an arbitrary identity URL.

## Descriptor

The JSON descriptor contains:

    {
      "schemaVersion": 1,
      "protocol": "phi-publisher-identity-v1",
      "origin": "https://public.example.org",
      "publisherId": "example-publisher",
      "publisherLabel": "Example Publisher",
      "administrativeDomainClaim": "example-publishing-admin",
      "publicKeyPem": "-----BEGIN PUBLIC KEY-----...",
      "publicKeyFingerprintSha256": "...",
      "claimedAt": "2026-10-02T13:02:00.000Z",
      "signatureBase64": "..."
    }

### origin

Must exactly equal the RPUB retrieval URL origin.

For example:

    RPUB retrieval:
      https://public.example.org/releases/REL-1.json

    descriptor origin:
      https://public.example.org

### publisherId

A self-selected stable publisher identifier.

This is not a verified legal identity.

### publisherLabel

A human-readable self-attested label.

### administrativeDomainClaim

A self-attested administrative grouping claim.

Examples:

    example-publishing-admin
    west-coast-release-service
    archive-operator-a

Think Tank stores this field as a claim.

It does not validate that the claim corresponds to a real-world legal, corporate, infrastructure, or administrative boundary.

### publicKeyPem

Ed25519 public key in SPKI PEM format.

### publicKeyFingerprintSha256

SHA-256 over the SPKI DER public-key bytes.

### claimedAt

Canonical ISO timestamp claimed by the descriptor signer.

It is not trusted time.

### signatureBase64

Ed25519 signature over the stable-canonical identity envelope.

## Signed envelope

The signature covers:

    {
      schemaVersion: 1,
      protocol: "phi-publisher-identity-v1",
      origin,
      publisherId,
      publisherLabel,
      administrativeDomainClaim,
      publicKeyPem,
      publicKeyFingerprintSha256,
      claimedAt
    }

The signature does not cover signatureBase64 itself.

## Network boundary

Before fetching the identity descriptor, the bridge:
1. revalidates the full historical RPUB package
2. revalidates the RPUB package-basis fingerprint
3. revalidates the RPUB package SHA-256
4. derives the retrieval origin from RPUB
5. derives the fixed .well-known identity URL

The GET uses:
- HTTPS only
- credential-free URL
- public DNS/IP validation
- private/loopback/link-local/reserved destination rejection
- pinned validated destination address
- no redirects
- no publisher bearer token
- application/json only
- 128 KiB maximum identity response

## Cryptographic verification

The bridge verifies:
- descriptor schema/protocol
- exact origin binding
- required claim fields
- canonical ISO claimedAt
- Ed25519 public-key type
- public-key fingerprint
- non-empty signature
- Ed25519 signature over the canonical envelope

A descriptor with a changed label, administrative-domain claim, key, origin, or claimed time fails unless it is signed again by the corresponding key.

## POID receipt

DossierPublisherOriginIdentityReceipt stores:
- POID id
- REL id
- RPUB id
- RPUB receipt SHA-256
- tool: publisher-origin-identity-verifier
- protocol: phi-publisher-identity-v1
- exact retrieval origin
- fixed identity URL
- complete descriptor SHA-256
- publisher id claim
- publisher label claim
- administrative-domain claim
- Ed25519 public key PEM
- public-key fingerprint SHA-256
- claimedAt
- descriptor signature Base64
- verified: true
- local verifiedAt
- clock: untrusted-local-clock
- POID receipt SHA-256
- trust: self-attested-origin-signing-key
- realWorldIdentityAuthority: false
- operatorIndependenceAuthority: false
- truthAuthority: false

IDs:

    POID-<RPUB-id>-<receipt-sha256-prefix>

## Time semantics

Two time fields may appear:

### claimedAt

Publisher-key self-attested time inside the signed descriptor.

The signature protects the value from modification after signing.

It does not make the clock trustworthy.

### verifiedAt

Local time when Think Tank verified the descriptor.

It is labeled:

    untrusted-local-clock

Neither field creates trusted-time authority.

## Key rotation

A publisher may rotate its identity key or change its signed claims.

A newly signed descriptor produces:
- a different descriptor SHA-256
- normally a different public-key fingerprint if the key rotated
- a new POID receipt

Think Tank allows multiple POID receipts for one RPUB when the descriptor actually changes.

The exact same descriptor SHA-256 may only be accepted once per RPUB.

This records identity-claim history without letting repeated verification inflate evidence.

## Publisher-side helpers

Generate a dedicated Ed25519 key:

    npm run publisher:identity:keygen -- publisher-identity-private.pem publisher-identity-public.pem

The private key should remain on the publisher/deployment side.

Do not configure it in the Think Tank bridge.

Create a signed descriptor:

    npm run publisher:identity:sign -- \
      https://public.example.org \
      example-publisher \
      "Example Publisher" \
      example-publishing-admin \
      publisher-identity-private.pem \
      phi-publisher-identity.json

Then serve the output at:

    https://public.example.org/.well-known/phi-publisher-identity.json

The signer derives:
- public key
- public-key fingerprint
- canonical claimedAt
- Ed25519 signature

## Governed events

- dossier.release.publisher.identity.requested — operator
- dossier.release.publisher.identity.completed — tool
- dossier.release.publisher.identity.failed — tool

The kernel enforces:
- no identity verification mutation during active governed execution
- operator-only request
- existing RPUB requirement
- historical RPUB package reconstructability
- tool-only completion/failure
- exact REL/RPUB linkage
- exact RPUB receipt-SHA linkage
- exact RPUB retrieval-origin linkage
- fixed .well-known identity URL
- descriptor/key/receipt SHA shapes
- required publisher/admin claim fields
- canonical claimedAt
- verified: true
- explicit local clock/trust labels
- all authority flags remain false
- deterministic POID id
- duplicate exact descriptor rejection
- matching operator request
- one terminal result per request
- deterministic replay

The kernel does not redo Ed25519 cryptography.

That remains at the Node bridge boundary.

## UI

The release panel adds:

    PUBLISHER ORIGIN IDENTITY

States:
- RPUB REQUIRED
- NOT VERIFIED
- SIGNED ORIGIN CLAIM VERIFIED

The panel displays:
- POID id
- RPUB id
- retrieval origin
- identity URL
- publisher id
- publisher label
- administrative-domain claim
- origin-key fingerprint
- descriptor SHA-256
- self-attested claimedAt
- local verifiedAt
- POID receipt SHA-256
- explicit non-authority labels

Action:

    VERIFY ORIGIN IDENTITY

## Export

TEAR / EXPORT DOSSIER includes:

    publisherOriginIdentities

POID receipts are not inserted into the governed release package.

They are external evidence about the origin serving an RPUB package.

## Bridge

Bridge version advances to:

    0.14.0

New route:

    POST /dossier/release/publisher/identity

No new Think Tank environment variables are required.

## Relationship to RAVA

PR 30 does not change RAVA policy semantics.

RAVA still treats distinct HTTPS origins as topology evidence only and keeps:

    originIndependenceAuthority: false

POID creates a new evidence layer that a later explicit policy may choose to evaluate.

This avoids retroactively changing the meaning of existing RAVA reports.

## Future stronger identity

A future rung could bind an origin key to stronger external evidence such as:
- organization-issued attestations
- certificate-backed organizational identity
- independently verified administrative registries
- signed trust-policy snapshots

Those stronger layers should remain separate from POID rather than silently upgrading self-attested claims.

## Non-goals

PR 30 does not:
- verify legal identity
- verify company ownership
- prove two keys belong to two operators
- prove two administrative claims are independent
- modify RAVA
- modify release authorization
- modify synthesis governance
- establish publisher reputation
- rank publishers
- create trusted time
- make content true
