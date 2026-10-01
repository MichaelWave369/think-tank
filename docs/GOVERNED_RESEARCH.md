# Governed Research / Search

PR 11 adds operator-authorized source discovery without turning search results into evidence.

## Core law

**Search result ≠ evidence.**

The pipeline is:

`CLAIM → SEARCH REQUEST → CANDIDATES → MACHINE RETRIEVAL → EVIDENCE → CLAIM BINDING`

Only the machine-retrieval step can create a `machine-verified` evidence receipt.

## Search backend

PR 11 uses an optional SearXNG adapter.

Why:

- open source
- local-first
- no required paid API
- metasearch across configurable engines
- JSON search API when explicitly enabled

The Think Tank remains usable when SearXNG is not configured.

Set:

`SEARXNG_URL=http://127.0.0.1:8888`

and optionally:

`RESEARCH_MAX_RESULTS=5`

The kernel caps a search receipt at 10 candidates even if bridge configuration is changed.

## SearXNG JSON requirement

SearXNG controls allowed response formats in `settings.yml`.

JSON must be enabled:

    search:
      formats:
        - html
        - json

If JSON is not enabled, SearXNG returns HTTP 403 for `format=json`.

PR 11 uses:

`GET /search?q=<query>&format=json&safesearch=1`

## Local container setup

Official SearXNG documentation recommends container/Compose deployment.

A minimal local container can be exposed on port 8888 and then configured through its mounted `settings.yml`.

After SearXNG is running and JSON output is enabled:

    SEARXNG_URL=http://127.0.0.1:8888

Restart the Think Tank provider bridge after changing `.env`.

See the current official SearXNG container and Search API documentation before deployment because container templates evolve over time.

## Operator authority

Search starts only after an operator selects:

- an existing canonical claim
- a search query

The ledger records:

`research.search.requested`

The search tool may then emit exactly one terminal result:

- `research.search.completed`
- `research.search.failed`

A completion must match a real unresolved operator request.

Search cannot run during active governed execution.

## Candidate quarantine

Search results become `ResearchCandidate` records.

Each candidate stores:

- candidate id
- claim id
- exact query
- title
- canonical HTTP/S URI
- snippet
- source engine
- rank
- discovery timestamp

Candidates:

- are fingerprinted
- are replayable
- are not evidence
- do not affect Reality Gate
- cannot authorize action
- cannot be bound directly to a claim as evidence

## Search receipt

Each completed search stores:

- search receipt id
- tool: `searxng-search`
- provider: `searxng`
- claim id
- query
- search timestamp
- SHA-256 digest of the bridge-normalized result set
- ranked novel candidate list

Repeated searches may rediscover URLs already quarantined for the same claim. Those URLs remain represented by their existing candidate records rather than being duplicated; the new search receipt still preserves the bridge result-set digest.

The digest proves which normalized candidate set the local bridge accepted.

It does not prove search-engine completeness or source quality.

## Candidate normalization

The bridge:

- rejects missing title/URL entries
- accepts HTTP/S URLs only
- rejects embedded URL credentials
- rejects nonstandard HTTP/S ports that the evidence verifier would not promote
- canonicalizes URLs
- deduplicates URLs
- truncates oversized title/snippet/engine metadata
- ranks accepted results contiguously
- caps result count

The event kernel independently checks candidate structure and replay integrity.

## Promotion to evidence

The operator may choose:

`VERIFY → EVIDENCE`

That reuses the PR 9 machine retrieval path.

The evidence receipt preserves:

`researchCandidateId`

The kernel requires:

- candidate exists
- retrieval requested URI equals candidate URI
- candidate has not already been promoted
- retrieval receipt passes all PR 9 verification laws

Only then does the candidate become machine-verified evidence.

## Existing evidence reuse

If research rediscovers a URI already present in the Evidence Packet, the Research Console shows:

`ALREADY EVIDENCE`

The operator should reuse that receipt and bind it to additional claims.

PR 11 rejects duplicate evidence URIs.

For machine evidence, it also rejects a duplicate SHA-256 body digest even when exposed under a different URL.

This prevents duplicate provenance from inflating Reality Gate breadth.

## Claim interpretation remains separate

Promotion verifies retrieval provenance.

It does **not** decide whether the source:

- supports the claim
- contradicts the claim
- merely provides context

The operator still creates an explicit PR 10 binding afterward.

## Reality Gate

Search discovery contributes exactly zero to Reality Gate.

A completed search does not:

- change Gate score
- invalidate an existing Gate result
- add evidence
- authorize action

Promotion through machine retrieval changes the Evidence Packet and therefore triggers the existing Gate invalidation/rerun law.

## Bridge runtime repair

While implementing PR 11, two provider-bridge helpers referenced since PR 7 were found to be missing at runtime:

- `fetchJson`
- `normalizeMessages`

PR 11 restores both with:

- timeout/error handling
- JSON response validation
- message role/content validation
- message count/content size limits

Bridge unit tests now exercise these helpers so syntax-only CI cannot hide the regression again.

## Non-goals

PR 11 does not:

- automatically decide which candidate is credible
- automatically promote search results to evidence
- automatically bind a promoted source to a claim relation
- make search ranking part of Reality Gate
- scrape arbitrary result pages
- expose the local search backend publicly
- require a paid search API

Those remain explicit future rungs.
