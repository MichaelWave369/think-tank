# Provider Adapters + LIVE Execution

PR 7 connects real model providers without changing the Think Tank role, scheduler, routing, governance, or ledger contracts.

## Architecture

Browser UI → local provider bridge → provider

The bridge binds to `127.0.0.1:3691` by default.

Secrets remain in the local Node process. They are never placed in React state, localStorage, or frontend bundles.

## Why a local bridge

A public unauthenticated serverless proxy holding API keys would let arbitrary visitors spend the operator's API balance.

PR 7 deliberately does **not** ship that architecture.

The local bridge:
- defaults to loopback only
- allows localhost browser origins automatically
- can allow an explicit deployed UI origin with `THINK_TANK_ORIGIN`
- never returns API keys
- limits request body size
- caps generated output tokens
- validates role and seat ids
- uses fixed provider endpoints
- provides governed public-URL evidence retrieval with SSRF/private-network defenses

## Current provider transports

### Ollama

- status/model discovery: `GET http://127.0.0.1:11434/api/tags`
- chat: `POST http://127.0.0.1:11434/api/chat`
- streaming is disabled for the first governed adapter so each completed provider response becomes one canonical event

### OpenAI

- transport: Responses API
- endpoint: `https://api.openai.com/v1/responses`
- requires both `OPENAI_API_KEY` and `OPENAI_MODEL`
- status is CONFIGURED without sending a billable probe

ChatGPT subscription billing and API billing are separate. Configure API billing independently if this seat is enabled.

### Kimi / Moonshot

- international base URL: `https://api.moonshot.ai/v1`
- chat endpoint: `/chat/completions`
- requires both `KIMI_API_KEY` and `KIMI_MODEL`
- `KIMI_BASE_URL` may be changed server-side for another Moonshot region

## Setup

    cp .env.example .env
    npm install
    npm run bridge

In another terminal:

    npm run dev

The browser Provider Bridge console can then refresh provider status.

## Local-first path

No remote keys are required.

1. start Ollama
2. run `npm run bridge`
3. open the Think Tank
4. REFRESH PROVIDERS
5. choose a detected Ollama model
6. SYNC HEALTH → CRANE FLY
7. pin roles to LOCAL BRAIN if desired
8. RUN LIVE MODE

## Provider health vs routing authority

Provider health is observational until the operator chooses:

`SYNC HEALTH → CRANE FLY`

That action emits canonical `seat.status` events.

The bridge itself does not silently change routing authority.

## LIVE execution order

1. operator prompt
2. Crane Fly assignment receipts
3. routing complete
4. session started
5. scheduler plan
6. round start
7. provider turn start
8. provider response or provider failure
9. Reality Gate
10. synthesis result

Provider response events use `source: provider`.

They retain:
- role
- seat
- provider model
- latency
- provider request id when available

## Failure behavior

Provider transport failure emits:

1. `provider.failed`
2. `governance.fault`
3. `synthesis.withheld`

The failed session does not pretend the scheduled queue completed.

ABORT remains available during live requests.

## Reality Gate behavior

PR 8 adds deterministic LIVE evidence scoring.

Provider completion alone cannot pass the normal threshold: model output without external evidence is capped at `0.65`.

Operator-attested and future machine-verified evidence receipts can raise the authorized scoring range according to [EVIDENCE_GATE.md](EVIDENCE_GATE.md).

The selected mode law still decides whether the resulting score produces informational completion, speculative output, draft output, or withheld synthesis.

## Evidence retrieval

PR 9 adds:

`POST /evidence/fetch`

The endpoint accepts an operator-authorized public HTTP/S URL and returns only a provenance receipt:

- requested/final URI
- status
- content type
- bytes
- SHA-256
- redirects
- retrieval timestamp

The fetched body is not returned to the browser.

See [MACHINE_EVIDENCE.md](MACHINE_EVIDENCE.md).

## Cost guardrails

Remote providers are disabled until both key and model are explicitly configured.

`PROVIDER_MAX_OUTPUT_TOKENS` defaults to `1200`.

The status endpoint does not send billable remote inference probes.

## Security notes

- never commit `.env`
- never put provider keys in `VITE_*` variables
- do not bind the bridge to `0.0.0.0` unless you understand the network exposure
- use an exact `THINK_TANK_ORIGIN` for a deployed UI
- do not expose the provider bridge directly to the public internet
- keep evidence byte/redirect limits conservative
- machine-verified retrieval is not a factual-truth assertion

## Acceptance criteria

- Ollama models can be discovered without remote API credentials
- remote seats remain disconnected until explicitly configured
- role prompts are provider-neutral
- provider outputs enter the canonical event stream
- provider failures become governed faults
- LIVE sessions replay exactly
- threshold modes fail closed without a real evidence scorer
- frontend source contains no API secrets


## Governed research search

PR 11 adds optional local-first SearXNG endpoints:

- `GET /research/status`
- `POST /research/search`

The search endpoint accepts only a query. The SearXNG backend URL is administrator-controlled through `SEARXNG_URL`; operators cannot turn the bridge into an arbitrary fetch proxy.

Search results are normalized, deduplicated, capped, and hashed before returning to the browser.

They enter canonical state as quarantined candidates, not evidence.

Repeated searches retain their search receipt/digest but only create new candidate records for URLs not already quarantined for that claim.

See [GOVERNED_RESEARCH.md](GOVERNED_RESEARCH.md).

### Bridge runtime validation

PR 11 also restores and tests the provider bridge helpers used by provider status/chat:

- `fetchJson`
- `normalizeMessages`

Provider message input now has explicit role, count, and content-size validation.
