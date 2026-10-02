# Verified External Checkpoint Publication

PR 22 adds an optional external publication layer for portable transparency checkpoints.

## Core law

**PUBLISHED ≠ IMMUTABLE ≠ ENDORSED ≠ TRUE DECISION.**

A verified publication receipt means:
- the operator authorized publication of one existing checkpoint
- the configured publisher accepted that checkpoint
- the publisher returned a retrieval URL
- the bridge independently retrieved JSON from that URL
- the retrieved checkpoint exactly matched the canonical checkpoint
- the read-back occurred over an allowed public HTTPS destination

It does not prove:
- the publication will remain available forever
- the publisher cannot later delete or replace content
- the publisher endorses the checkpoint
- the publisher's claimed wall-clock time is trusted
- the checkpoint is factually correct
- the underlying decision is correct

## Why publication is separate

PR 19 provides local hash-chain continuity.

PR 20 provides portable checkpoints and detached witnesses.

PR 21 provides optional RFC 3161 time attestation.

PR 22 answers a different question:

> Was this exact checkpoint observed at an externally retrievable location?

That is useful publication evidence, but it is not the same thing as:
- trusted time
- append-only storage
- independent witness identity
- factual truth

## Configuration

Publication is disabled unless:

```
CHECKPOINT_PUBLISH_URL=https://publisher.example.org/api/checkpoints
```

Optional retrieval-origin restriction:

```
CHECKPOINT_PUBLISH_RETRIEVAL_ORIGIN=https://public.example.org
```

If omitted, retrieval URLs must use the same origin as `CHECKPOINT_PUBLISH_URL`.

Optional publisher authentication:

```
CHECKPOINT_PUBLISH_BEARER_TOKEN=...
```

The bearer token:
- remains in the local bridge
- is sent only to the configured publisher POST endpoint
- is never returned to the browser
- is never stored in canonical state
- is never sent to the public retrieval URL

## Protocol

The protocol identifier is:

```
phi-checkpoint-publication-v1
```

### Request

The bridge POSTs JSON:

```json
{
  "protocol": "phi-checkpoint-publication-v1",
  "checkpoint": {
    "...": "canonical DossierTransparencyCheckpoint"
  }
}
```

The request uses:
- HTTPS
- `Content-Type: application/json`
- `Accept: application/json`
- optional `Authorization: Bearer ...`

The publisher endpoint itself is bridge configuration. Browser code cannot choose the destination.

### Response

The publisher must return JSON:

```json
{
  "protocol": "phi-checkpoint-publication-v1",
  "publicationId": "publisher-defined-stable-id",
  "checkpointId": "CHK-...",
  "checkpointSha256": "...",
  "retrievalUrl": "https://public.example.org/checkpoints/CHK-....json",
  "publishedAt": "2026-10-02T01:02:00.000Z"
}
```

Requirements:
- protocol must match exactly
- checkpoint id must match
- checkpoint SHA-256 must match
- publication id must be non-empty
- publishedAt must parse as a timestamp
- retrieval URL must use HTTPS
- retrieval URL must contain no credentials or fragment
- retrieval URL origin must equal the configured retrieval origin

The publisher's `publishedAt` field is explicitly treated as a publisher claim, not trusted time.

Use PR 21 RFC 3161 if trusted timestamp semantics are required.

## Read-back verification

A successful POST response is not enough.

The bridge performs a second request:

```
GET <retrievalUrl>
Accept: application/json
```

The GET:
- receives no publisher bearer token
- uses public-network DNS/IP validation
- pins the validated destination address for the request
- follows no redirects
- accepts only HTTPS
- limits response bytes
- requires `application/json`
- parses the response as a checkpoint object
- revalidates the checkpoint digest/id
- requires exact stable-canonical JSON equality with the original checkpoint

Only after this read-back succeeds does the bridge emit a publication receipt.

## Public-network boundary

Both publisher POST and retrieval GET destinations pass the same public-network restrictions used by governed evidence retrieval.

Private, loopback, link-local, multicast, and reserved destinations are rejected.

This prevents a publisher response from turning the retrieval step into a server-side request forgery primitive.

No redirects are followed during publication or read-back.

## Receipt

A DossierCheckpointPublicationReceipt stores:
- receipt id
- checkpoint id
- `verified-checkpoint-publisher`
- `phi-checkpoint-publication-v1`
- checkpoint SHA-256
- configured publisher URL
- returned retrieval URL
- publisher-defined publication id
- publisher-claimed publication time
- SHA-256 of the stable-canonical full checkpoint payload
- retrieval HTTP status
- retrieval content type
- local read-back verification time
- receipt SHA-256
- `externally-retrieved-publication`

Receipt ids have the form:

```
PUB-<checkpoint-id>-<receipt SHA-256 prefix>
```

## Two checkpoint hashes

Publication receipts contain two related hashes.

### checkpointSha256

This is the existing PR 20 checkpoint digest.

It covers the checkpoint's defined hash basis.

### payloadSha256

This hashes the stable-canonical full checkpoint object, including its derived id and checkpoint digest.

It records the exact object published and read back.

## Receipt SHA-256

The publication receipt SHA-256 covers stable canonical JSON containing:
- checkpoint linkage
- protocol/tool labels
- publisher URL
- retrieval URL
- publication id
- publisher-claimed time
- payload SHA-256
- retrieval status/content type
- local verification time
- trust label

The derived receipt id itself is not recursively included in the hash basis.

## Governed events

Events:
- `dossier.publication.requested` — operator
- `dossier.publication.completed` — tool
- `dossier.publication.failed` — tool

The kernel enforces:
- existing checkpoint linkage
- no publication mutation during active governed execution
- operator-only request
- tool-only completion/failure
- HTTPS publisher/retrieval URL shape
- supported protocol/tool/trust labels
- checkpoint digest linkage
- SHA-256 field shape
- successful JSON retrieval status/content type
- deterministic receipt id shape
- one accepted publication per checkpoint + publisher URL
- matching operator request
- one terminal result per request
- deterministic replay

Actual network verification and SHA-256 work remain in the local Node bridge.

## Multiple publishers

A checkpoint may accumulate publication receipts from multiple publisher URLs.

The same publisher URL may only contribute one accepted publication receipt per checkpoint.

This allows future replication across independent hosts without inflating state through repeated publication to one endpoint.

## UI

The Decision Dossier checkpoint section shows:
- publisher READY / DISABLED / ERROR
- verified publication count
- publication id
- publisher URL
- retrieval URL
- checkpoint SHA-256
- canonical payload SHA-256
- publisher-claimed time
- local read-back verification time
- receipt SHA-256

The operator action is:

```
PUBLISH + VERIFY CHECKPOINT
```

## Export

Decision Dossier exports include linked:

```
checkpointPublications
```

Receipts do not contain the bearer token.

## Failure policy

Publication fails closed when:
- publisher configuration is missing/invalid
- publisher or retrieval destination is not allowed public HTTPS
- DNS resolves to a blocked network range
- publisher POST fails
- publisher response is not JSON
- publisher protocol/checkpoint linkage is wrong
- retrieval origin is wrong
- retrieval GET fails
- retrieval content type is not JSON
- retrieved JSON is malformed
- retrieved checkpoint digest/id is invalid
- retrieved checkpoint differs from the original

A failure creates a governed failure event and no accepted publication receipt.

## Non-goals

PR 22 does not:
- provide its own hosted public publisher
- claim append-only remote storage
- claim publisher immutability
- trust publisher wall-clock time
- replace RFC 3161
- replace detached witnesses
- establish publisher identity or reputation
- alter Reality Gate scoring
- authorize synthesis
- make a decision true
- create a blockchain
