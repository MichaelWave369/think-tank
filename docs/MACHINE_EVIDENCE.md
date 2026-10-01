# Machine-Verified Evidence Retrieval

PR 9 adds the first governed tool that may create `machine-verified` evidence.

## Semantic boundary

**Machine-verified means retrieved + provenance-recorded + hashed.**

It does **not** mean:

- the source is trustworthy
- every claim in the source is true
- the source is independent
- the source supports the operator's interpretation

Those are separate reasoning problems.

## Operator flow

1. operator enters label + URL + optional note
2. operator selects `FETCH + MACHINE VERIFY`
3. ledger records `evidence.fetch.requested`
4. local provider bridge validates the URL
5. bridge retrieves the resource
6. bridge hashes the exact accepted response bytes with SHA-256
7. bridge returns a retrieval receipt
8. browser emits tool-originated `evidence.added`
9. event kernel validates the receipt
10. evidence packet changes and any prior Gate result is invalidated

Failure emits `evidence.fetch.failed` and adds no evidence.

## Retrieval receipt

A machine-verified evidence reference carries:

- tool id: `url-fetch`
- requested URI
- final URI after redirects
- HTTP status
- content type
- accepted byte count
- SHA-256 digest
- redirect count
- retrieval timestamp

The evidence reference URI must equal the final retrieved URI.

## Network policy

The bridge is local and performs retrieval server-side.

Allowed:
- HTTP on port 80
- HTTPS on port 443
- public IP destinations
- up to the configured redirect cap

Rejected:
- credentials embedded in URLs
- non-HTTP/S schemes
- nonstandard ports
- loopback
- RFC1918/private networks
- link-local addresses
- carrier-grade NAT space
- benchmark/private-like ranges
- multicast/reserved high IPv4 ranges
- IPv6 loopback
- IPv6 link-local
- IPv6 unique-local
- IPv6 multicast

Every redirect is revalidated.

## DNS-rebinding defense

Hostnames are resolved first.

Every resolved address must pass the public-address policy.

The actual HTTP/S connection is then pinned to the exact validated address rather than allowing the transport to resolve the hostname a second time.

HTTPS keeps the original hostname for TLS/SNI validation.

## Resource policy

Accepted content types:

- `text/*`
- `application/json`
- `application/xml`
- `application/xhtml+xml`
- `application/pdf`

The response body is byte-capped.

Defaults:

- `EVIDENCE_MAX_BYTES=2000000`
- `EVIDENCE_MAX_REDIRECTS=3`

The response body is not returned to the browser or stored in the Think Tank ledger.

Only the provenance receipt and digest enter canonical state.

## Authority law

Only the governed tool source may add `machine-verified` evidence.

The event kernel rejects:

- operator-created machine verification
- system-created machine verification
- provider-created machine verification
- machine evidence without a retrieval receipt
- non-success HTTP status
- malformed SHA-256
- invalid timestamp
- invalid redirect count
- evidence URI that differs from the final retrieval URI

The operator remains authorized to remove an evidence receipt afterward.

PR 11 may attach a `researchCandidateId` to a machine-verified receipt. The kernel then requires the retrieval request URI to match the quarantined candidate URI.

Evidence URIs are unique. Machine evidence with an already-recorded SHA-256 content digest is also rejected, even under a different URL. Reuse one receipt across multiple claims rather than duplicating provenance.

## Reality Gate effect

The existing PR 8 scoring law is unchanged.

A machine-verified external source receives verification weight `1.00`.

For a healthy Council, one machine-verified external source can produce:

- external support = 0.50
- raw/final score = 0.825
- no evidence-class cap
- normal mode threshold decides the result

This is stronger than one operator attestation because the system independently verified retrieval provenance.

It is not stronger because the webpage is presumed more truthful.

## CI

PR 9 adds Node-level network policy tests for:

- private/local IPv4 rejection
- private/local IPv6 rejection
- metadata/loopback URL rejection
- embedded credential rejection
- nonstandard port rejection
- public direct-IP URL acceptance without fetching

The existing TypeScript/Vitest suite covers receipt provenance and deterministic replay.
