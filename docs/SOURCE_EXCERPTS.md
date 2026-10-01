# Hash-Locked Source Excerpts

PR 14 adds exact source-text excerpts on top of machine-verified evidence.

## Core law

**EXACT EXCERPT ≠ CLAIM TRUE.**

An excerpt proves:

- which machine-verified evidence receipt it came from
- that the source was re-fetched
- that the re-fetched bytes matched the original SHA-256
- which deterministic text projection was used
- the exact character range selected
- the exact excerpt text
- SHA-256 digests for the projection and excerpt

It does not prove:

- the source is trustworthy
- the claim is true
- the excerpt is representative of the whole source
- the operator's SUPPORTS / CONTRADICTS / CONTEXT interpretation is correct

Those remain separate governance layers.

## Flow

1. operator already has a machine-verified EvidenceRef
2. operator selects EXTRACT SOURCE TEXT
3. bridge re-fetches the source using the PR 9 network policy
4. bridge requires the new source SHA-256 to equal the original EvidenceRef retrieval SHA-256
5. bridge derives deterministic text projection v1
6. preview text remains transient UI state
7. operator selects an exact character range
8. ledger records evidence.excerpt.requested
9. bridge re-fetches + re-verifies the same source bytes again
10. bridge returns exact excerpt receipt
11. ledger records tool-originated evidence.excerpt.added

If the source changed, pinning fails.

## Canonical EvidenceExcerpt

A pinned excerpt stores:

- excerpt id
- evidence id
- tool: text-projector
- extractor: text-projection-v1
- source URI
- original source SHA-256
- text projection SHA-256
- excerpt SHA-256
- content type
- start character offset
- end character offset
- exact excerpt text
- extraction timestamp
- addedBy: tool

The hard kernel maximum is 1600 characters per excerpt.

## Projection v1

Supported:

- text/*
- text/html
- application/xhtml+xml
- application/json
- application/xml

Projection behavior is deterministic:

- UTF-8 decoding
- HTML comments removed
- script/style/noscript/svg content removed
- common block boundaries converted to newlines
- markup removed
- common/numeric entities decoded
- whitespace normalized
- projection capped to configured character limit

Default preview cap:

EVIDENCE_PROJECTION_MAX_CHARS=100000

## PDF boundary

PDF remains valid machine-verified evidence.

PR 14 deliberately does **not** pretend raw PDF bytes can be converted to reliable text with a regex.

PDF source-text projection returns an explicit unsupported error.

A later PDF-specific extraction rung may add a proper parser with its own frozen extractor/version contract.

## Source-change defense

The excerpt endpoint receives the original machine-verification SHA-256.

It re-fetches the source using the same SSRF/DNS-rebinding protections as PR 9.

If:

new SHA-256 != original SHA-256

the bridge returns a conflict and creates no excerpt.

Same URL is not treated as same evidence.

## Preview vs canonical state

Source projection preview is transient.

The full projected page text is not stored in the event ledger.

Only the operator-selected excerpt enters canonical state.

This keeps replay compact and avoids silently turning the ledger into a webpage archive.

## Deletion law

Evidence with pinned excerpts cannot be removed.

The operator must:

1. remove excerpt receipt(s)
2. unbind claim relations if any
3. remove evidence

Every step is ledger-visible.

## Challenger freshness

Pinned excerpts are included in the deterministic Challenger review basis.

Adding or removing an excerpt therefore makes a prior review of any claim bound to that evidence STALE.

This is intentional: the evidence interpretation basis changed.

## Authorization

Adding or removing a pinned excerpt invalidates current Gate/action authorization and requires a rerun.

PR 14 does not change Reality Gate numeric weights.

It changes what exact source content is available in the governed evidence basis.

## Non-goals

PR 14 does not:

- auto-select quotations
- ask a model to rewrite excerpts
- auto-bind excerpts to claim relations
- score excerpt credibility
- support PDF text extraction
- archive complete source bodies in canonical state
- change Reality Gate weights
