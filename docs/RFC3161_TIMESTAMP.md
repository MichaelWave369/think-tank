# RFC 3161 Timestamp Attestation

PR 21 adds an optional standards-based time-attestation layer for portable transparency checkpoints.

## Core law

**RFC3161 VERIFIED ≠ UNIVERSALLY TRUSTED TIME ≠ TRUE DECISION.**

A successful receipt means:
- the checkpoint digest was used as the RFC 3161 message imprint
- the returned timestamp reply verified against that query
- OpenSSL validated the token under the operator-configured CA/trust-anchor file
- the token's TSA metadata was extracted and stored
- the raw token remains available for future inspection

It does not mean:
- every third party trusts the configured CA file
- the TSA is infallible
- the local OpenSSL installation is universally trusted
- the TSA's operational controls have been independently audited by Think Tank
- the underlying dossier or decision is true

## Why RFC 3161

PR 20's detached witness proves that an Ed25519 key signed a checkpoint.

It deliberately does not provide authoritative time.

RFC 3161 is a standard protocol for a Time-Stamp Authority to sign a message imprint together with a generation time and policy information.

PR 21 keeps this layer separate from:
- dossier sealing
- local journal continuity
- detached witness identity
- decision governance

## Configuration

Timestamping is disabled unless both of these are configured:

```
RFC3161_TSA_URL=https://tsa.example.org
RFC3161_TSA_CA_FILE=/path/to/intended-trust-anchor.pem
```

OpenSSL defaults to `openssl` on PATH.

Override it when necessary:

```
RFC3161_OPENSSL_BIN=/path/to/openssl
```

The CA file is an operator decision.

Think Tank does not silently bundle or select a timestamp trust root.

## Status states

The bridge reports:
- `disabled` — URL or CA file not configured
- `configured` — URL, CA file, and OpenSSL are available
- `error` — configuration exists but is unusable

Status also exposes:
- authority URL
- SHA-256 of the configured trust-anchor file
- OpenSSL version string

No TSA request is sent by the status check.

## Request flow

```
PORTABLE CHECKPOINT
  → OPERATOR REQUEST
  → OPENSSL RFC3161 QUERY
  → TSA HTTP(S) POST
  → DER TIMESTAMP REPLY
  → OPENSSL QUERY/TOKEN VERIFICATION
  → TSA METADATA EXTRACTION
  → GOVERNED TIMESTAMP RECEIPT
```

The query uses:
- SHA-256
- the checkpoint SHA-256 as the message imprint
- certificate inclusion request

The bridge never sends the full decision dossier to the TSA.

## Verification flow

The bridge runs the equivalent of:

```
openssl ts -verify \
  -queryfile request.tsq \
  -in reply.tsr \
  -CAfile configured-trust-anchor.pem
```

The same query file that was sent for timestamping is used for verification.

This binds the accepted token to the checkpoint digest.

## Stored receipt

A DossierRfc3161TimestampReceipt stores:
- receipt id
- checkpoint id
- RFC 3161 standard label
- SHA-256 message-imprint label
- checkpoint SHA-256
- raw DER token as Base64
- token SHA-256
- TSA policy OID
- TSA serial number
- TSA generation time
- TSA subject
- authority URL
- configured trust-anchor file SHA-256
- local verification time
- `configured-rfc3161-trust-anchor`

Receipt ids have the form:

```
TSA-<checkpoint-id>-<token SHA-256 prefix>
```

## Raw-token retention

The raw DER timestamp reply is stored in Base64 form.

This is intentional.

A future verifier should not have to trust that the original Think Tank instance parsed the token correctly.

The stored token can be decoded and independently inspected with compatible RFC 3161 tooling.

## Trust-anchor digest

The receipt stores SHA-256 of the exact configured CA/trust-anchor file bytes.

This is not necessarily the fingerprint of one certificate.

A CA file may contain multiple PEM certificates.

The field records the local verification trust configuration as a file artifact.

## Governed event flow

Events:
- `dossier.timestamp.requested` — operator
- `dossier.timestamp.completed` — tool
- `dossier.timestamp.failed` — tool

The kernel enforces:
- timestamp operations cannot mutate state during active governed execution
- the checkpoint must already exist
- tool-only completion/failure
- supported RFC 3161 receipt metadata
- checkpoint digest linkage
- timestamp/token/trust-anchor digest shape
- deterministic receipt id
- one accepted receipt per checkpoint + authority URL + trust-anchor digest
- matching operator request
- one terminal result per request
- deterministic replay

## Network boundary

The TSA URL is bridge configuration, not browser request input.

Browser code cannot choose an arbitrary URL for a timestamp request.

The configured URL may use HTTP or HTTPS because RFC 3161 token authenticity comes from the signed response, though HTTPS remains preferable for transport privacy and service-authentication reasons.

Embedded URL credentials are rejected.

## Temporary files

OpenSSL query/reply files are created in a temporary directory.

The bridge removes the temporary directory after success or failure.

The persistent receipt contains the raw returned token, not the temporary files.

## UI

The Decision Dossier checkpoint section shows:
- TSA CONFIGURED / DISABLED / ERROR
- RFC 3161 verification state
- TSA generation time
- checkpoint SHA-256
- token SHA-256
- policy OID
- serial
- TSA subject
- authority URL
- trust-anchor file SHA-256
- local verification time

The operator action is:

```
REQUEST RFC3161 TIMESTAMP
```

## Export

Decision Dossier JSON exports include linked `rfc3161Timestamps`.

Each timestamp receipt includes the raw token.

## Failure policy

Timestamping fails closed if:
- OpenSSL is unavailable
- trust-anchor file is missing
- checkpoint digest is invalid
- timestamp query generation fails
- TSA transport fails
- TSA response is empty or excessively large
- OpenSSL verification fails
- TSA reply metadata is malformed
- generation time cannot be parsed

A failure creates a governed failure event but no accepted timestamp receipt.

## Non-goals

PR 21 does not:
- choose a globally trusted TSA
- download or update CA roots automatically
- establish TSA reputation
- replace detached witnesses
- prove witness identity
- prove the decision content is true
- alter Reality Gate scoring
- authorize synthesis
- create a blockchain

## PR 22 publication relationship

RFC 3161 timestamps and verified external publication are independent checkpoint evidence layers:

```
CHECKPOINT
  ├─ DETACHED WITNESS
  ├─ RFC 3161 TIME ATTESTATION
  └─ VERIFIED EXTERNAL PUBLICATION
```

A publisher's `publishedAt` value is not promoted to trusted time. Use the verified RFC 3161 receipt for time-attestation semantics.

See [Verified External Checkpoint Publication](CHECKPOINT_PUBLICATION.md).
